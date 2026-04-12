const puppeteer = require('puppeteer');
const sessionFactory = require('../factories/sessionFactory');
const userFactory = require('../factories/userFactory');

class CustomPage {
  static async build() {
    const browser = await puppeteer.launch({
      // headless: false,

      // CI configuration:
      headless: 'new',
      // by turning on this no sandbox flag right here, it's going to decrease the amount of time that it takes for our test to run.
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    const customPage = new CustomPage(page);

    return new Proxy(customPage, {
      get: function (target, property) {
        // We must bind functions to their original object (page or browser),
        // because Proxy detaches methods and breaks `this`.
        // Puppeteer relies on `this` for private fields, so wrong binding causes errors.
        if (customPage[property]) {
          return customPage[property];
        }

        if (browser[property]) {
          const value = browser[property];
          return typeof value === 'function' ? value.bind(browser) : value;
        }

        if (page[property]) {
          const value = page[property];
          return typeof value === 'function' ? value.bind(page) : value;
        }
      },
    });
  }

  constructor(page) {
    this.page = page;
  }

  async login() {
    const user = await userFactory();
    const { session, sig } = sessionFactory(user);

    await this.page.setCookie(
      { name: 'session', value: session },
      { name: 'session.sig', value: sig },
    );
    // that's gonna cause the entire app to re-render,
    // and then we should see an updated header appear
    await this.page.goto('http://localhost:3000/blogs');
    // await this.page.goto('http://localhost:3000');
    await this.page.waitForSelector('a[href="/auth/logout"]');
  }

  async getContentsOf(selector) {
    return await this.page.$eval(selector, (el) => el.innerHTML);
  }

  get(path) {
    return this.page.evaluate((_path) => {
      return fetch(_path, {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json());
      // When we pass in path, that does not allow us to automatically just magically
      // get access to path inside the function itself under closure scope.
      // Instead, this variable is provided as an argument to this arrow function
    }, path);
  }
  post(path, data) {
    return this.page.evaluate(
      (_path, _data) => {
        return fetch(_path, {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(_data),
        }).then((res) => res.json());
      },
      path,
      data,
    );
  }

  execRequest(actions) {
    return Promise.all(
      actions.map(({ method, path, data }) => {
        return this[method](path, data);
      }),
    );
  }
}

module.exports = CustomPage;
