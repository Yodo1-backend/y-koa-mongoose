/**
 * @author XiaChengxing
 * @date 18/5/16 上午11:48
 */

var glob = require('glob');
var util = require('util');
var mongoose = require('mongoose');
mongoose.set('useNewUrlParser', true);
mongoose.set('useCreateIndex', true);

mongoose.Promise = global.Promise;

var middleware = module.exports = options => {
    mongoose = options.mongoose ? options.mongoose : mongoose;

    //mode: model
    var db = mongoose.connection
    middleware.models = {}
    middleware.dbs = {}
    if (options.schemas) {
        //mode: schema
        db = mongoose.createConnection()
        var schemas = options.schemas + (options.schemas.lastIndexOf('/') === (options.schemas.length - 1) ? '' : '/')
        var files = glob.sync(schemas + '/**/*.js')
        files.map(file => {
            var model = file
                .replace(schemas, '')
                .replace(/\.js$/g, '')
                .replace(/\//g, '.')
                .toLowerCase()
            var schema = require(file)
            middleware.models[model] = db.model(model, schema)
    })
    }
    middleware.open(db, options);
    return  async (ctx, next) => {
        var database = typeof options.database === 'function' ? options.database(ctx) : options.database || options.uri.match(/\/[^\/]+$/)[0].replace('/','');


        if (!middleware.dbs.hasOwnProperty(database)) {
            middleware.dbs[database] = db.useDb(database)
        }
        ctx.model = model => {
            try {
                return middleware.model(database, model)
            } catch(err) {
                ctx.throw(400, err.message)
            }
        }
        ctx.document = (model, document) => new (ctx.model(model))(document)
        await next()
    }
}

middleware.model = (database, model) => {
    var name = model.toLowerCase()
    if (!middleware.models.hasOwnProperty(name)) {
        throw new Error(util.format('Model not found: %s.%s', database, model))
    }
    return middleware.dbs[database].model(model, middleware.models[name].schema)
}

middleware.document = (database, model, document) => new (middleware.model(database, model))(document);

middleware.mongoose = mongoose;

middleware.open = (db, options) => {
    if (!options && (!options.host || !options.port) && !options.uri) {
        throw new Error('options not found')
    }

    var database = typeof options.database === 'function' ? undefined : options.database

    var uri = options.uri || `mongodb://${options.user ? options.user + ':' + options.pass + '@':''}${options.host}:${options.port}${database ?'/' + database : ''}`;

    db.on('error', err => {
        db.close();
});

    if(options.events){
        for (var evt in options.events){
            db.on(evt, options.events[evt])
        }
    }

    db.openUri(uri, options.mongodbOptions);

    return db
}