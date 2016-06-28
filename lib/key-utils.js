module.exports = function (config) {
    var self = this;
    var delimiter = ':';

    self.config = config;

    self.toKey = function (name, id, key) {
        if (typeof key === 'undefined') {
            return self.config.redis.options.keyPrefix + delimiter + name + delimiter + id;
        } else {
            return self.config.redis.options.keyPrefix + delimiter + name + delimiter + key + delimiter + id;
        }
    };

    return self;
};
