const mongoose = require('mongoose');
const redis = require('redis');
const keys = require('../config/keys');

const client = redis.createClient({ url: keys.redisUrl });
client.connect();
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true; // So we can call this useCache or _cache. It's totally up to us
  this.hashKey = JSON.stringify(options.key || ''); // naming is up to us
  return this; // to keep it chainable like .find().cache().limit(10) etc.
};

mongoose.Query.prototype.exec = async function () {
  if (!this.useCache) {
    return await exec.apply(this, arguments);
  }

  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    }),
  );
  //   See if we have a value for 'key' in redis,
  const cachedValue = await client.hGet(this.hashKey, key);

  // If we do, return that
  if (cachedValue) {
    const doc = JSON.parse(cachedValue);

    return Array.isArray(doc)
      ? doc.map((d) => new this.model(d))
      : new this.model(doc);
  }

  // otherwise, issue the query and store the result in redis
  const result = await exec.apply(this, arguments);
  await client.hSet(this.hashKey, key, JSON.stringify(result));
  await client.expire(this.hashKey, 10); // expires in 10 s
  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  },
};
