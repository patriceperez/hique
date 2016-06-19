module.exports = function (config) {
    var self = this;
    var delimiter = ':';

    self.config = config;

    self.toKey = function (name, key) {
        return self.config.redis.options.keyPrefix + delimiter + name + delimiter + key;
    };

    return self;
};
