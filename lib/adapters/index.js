var fs = require('fs');
var _ = require('lodash');

module.exports = function () {
    var adapterFiles = fs.readdirSync(__dirname);
    var adapters = {};

    _.each(adapterFiles, function (item) {
        if (item.indexOf(".js") > -1 && item != 'index.js')
            adapters[item.replace('.js', '')] = require(__dirname + '/' + item);
    });

    return adapters;
};