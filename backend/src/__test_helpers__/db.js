// src/__tests__/helpers/db.js
// Test database helper — connects to a real Mongo URI from .env.test or .env.
// Uses a separate test DB to avoid polluting the dev/production data.
'use strict';

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let isConnected = false;
let mongod = null;

async function connect() {
  if (isConnected) return;
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  await Promise.all(mongoose.modelNames().map(modelName => mongoose.model(modelName).init()));
  isConnected = true;
}

async function clearCollections(...modelNames) {
  for (const name of modelNames) {
    const model = mongoose.model(name);
    await model.deleteMany({});
  }
}

async function disconnect() {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
  isConnected = false;
}

module.exports = { connect, clearCollections, disconnect };
