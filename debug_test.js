const MongoStore = require('connect-mongo');
console.log('MongoStore.default:', MongoStore.default);
if (MongoStore.default) {
    console.log('MongoStore.default.create:', MongoStore.default.create);
}
console.log('MongoStore.MongoStore:', MongoStore.MongoStore);
if (MongoStore.MongoStore) {
    console.log('MongoStore.MongoStore.create:', MongoStore.MongoStore.create);
}
