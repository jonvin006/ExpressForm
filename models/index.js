'use strict';

var fs = require('fs');
var path = require('path');
var Sequelize = require('sequelize');
var encrypted = require('sequelize-encrypted');

var config = require('../config');

// TODO: move key to secrets file
var encryption_key = '53E19CAB12F077ECDCC03C01BC621C8E950F9198C568A41A6DFDCE2E2D155469';

var db = {};

var sequelize = new Sequelize(config.db.database, config.db.user, config.db.password, Object.assign({
    pool: {
        max: 5,
        min: 0,
        idle: 10000
    }
}, config.db));

var associations = [];

// A wrapper around sequelize.define that handles encrypted fields
// - fields marked `encrypted: true` are encrypted using `sequelize-encrypted`
// - a 'vault' column is added if necessary to store the encrypted fields
function define_table(name, model) {
    var encrypt = null;
    function encrypt_field(column) {
        if (!encrypt) {
            encrypt = encrypted(Sequelize, encryption_key);
            model['vault'] = encrypt.vault('vault');
        }
        return encrypt.field(column);
    }
    Object.keys(model).forEach(function (field) {
        if (model[field].encrypted) {
            model[field] = encrypt_field(model[field]);
        }
    });
    return sequelize.define(name, model);
}

// This model loader is different from the Seqeulize sample project
// Each module is passed only the `Sequelize` object, not `sequelize`
// Modules in this folder should export an object with the following fields:
// - name: the table name
// - fields: sequelize field definitions (additionally accepting `encrypted: true`)
// - associate (optional): a function that takes the current table and the database object,
//   and performs associations such as `belongsTo`
fs
    .readdirSync(__dirname)
    .filter(function (file) {
        return (file.indexOf('.') !== 0) && (file !== 'index.js');
    })
    .forEach(function (file) {
        var table = require(path.join(__dirname, file))(Sequelize);
        db[table.name] = define_table(table.name, table.fields);
        if (table.associate) {
            associations.push(() => table.associate(db[table.name], db));
        }
    });

associations.forEach(associate => associate());

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
