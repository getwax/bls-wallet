import mysql from 'mysql';

namespace db {
  let con:mysql.Connection;

  export function init(connection:mysql.Connection) {
    con = connection;
    con.query("CREATE DATABASE IF NOT EXISTS bls_aggregator", function (err, result) {
      if (err) throw err;
    });
    con.query("USE bls_aggregator", function (err, result) {
      if (err) throw err;
    });
    initTxTable();
  }

  function initTxTable() {
    con.query("DROP TABLE IF EXISTS txs", function(err, result) {
      if (err) throw err;
    });
    con.query("CREATE TABLE IF NOT EXISTS txs( \
      tx_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, \
      bls_pub_0 INT, \
      bls_pub_1 INT, \
      bls_pub_2 INT, \
      bls_pub_3 INT, \
      sender BINARY(20), \
      message_0 BINARY(32), \
      message_1 BINARY(32), \
      signature INT UNSIGNED, \
      recipient BINARY(20), \
      amount BINARY(32) \
      );", function(err, result) {
        if (err) throw err;
    });
  }

  export function addTx() {

  }

}

export default db;
