// app.js

var cfenv = require( 'cfenv' );
var express = require( 'express' );
var bodyParser = require( 'body-parser' );
var request = require( 'request' );
var app = express();

var settings = require( './settings' );
var appEnv = cfenv.getAppEnv();

app.use( express.static( __dirname + '/public' ) );
//app.use( bodyParser.urlencoded( { extended: true, limit: '10mb' } ) );
app.use( bodyParser.urlencoded() );
app.use( bodyParser.json() );


var dblib = require( 'node-couchdb' );
var db = null;

//. npm : https://www.npmjs.com/package/node-couchdb
var dbopt = {};
if( settings.db_username && settings.db_password ){
  dbopt['auth'] = { user: settings.db_username, pass: settings.db_password };
}
if( settings.db_host ){
  dbopt['host'] = settings.db_host;
}
if( settings.db_protocol ){
  dbopt['protocol'] = settings.db_protocol;
}
if( settings.db_port ){
  dbopt['port'] = settings.db_port;
}

db = new dblib( dbopt );
if( db ){
  db.listDatabases().then( function( dbs ){
    var b = false;
    dbs.forEach( function( db ){
      if( db == settings.db_name ){
        b = true;
      }
    });

    if( !b ){
      db.createDatabase( settings.db_name ).then( function(){
        createDesignDocument();
      }).catch( function( err ){
      });
    }
  }).catch( function( err ){
  });
}


app.post( '/doc', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  console.log( 'POST /doc' );

  var doc = req.body;
  doc.timestamp = ( new Date() ).getTime();
  //console.log( doc );

  if( db ){
    db.uniqid().then( function( id ){
      doc._id = id[0];

      db.insert( settings.db_name, doc ).then( function( body, headers, status ){
        console.log( body );
        res.write( JSON.stringify( { status: true, body: body }, 2, null ) );
        res.end();
      }).catch( function( err ){
        console.log( err );
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      });
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});

app.get( '/doc/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var id = req.params.id;
  console.log( 'GET /doc/' + id );

  if( db ){
    db.get( settings.db_name, id ).then( function( body, headers, status ){
      console.log( body );
      res.write( JSON.stringify( { status: true, doc: body }, 2, null ) );
      res.end();
    }).catch( function( err ){
      console.log( err );
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
      res.end();
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});

app.get( '/doc/:id/attachment', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var id = req.params.id;
  console.log( 'GET /doc/' + id + '/attachment' );

  if( db ){
    db.get( id, { include_docs: true }, function( err, body ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      }else{
        //. body._attachments.(attachname) : { content_type: '', data: '' }
        if( body._attachments ){
          for( key in body._attachments ){
            var attachment = body._attachments[key];
            if( attachment.content_type ){
              res.contentType( attachment.content_type );
            }

            //. 添付画像バイナリを取得する
            db.attachment.get( id, key, function( err, buf ){
              if( err ){
                res.contentType( 'application/json; charset=utf-8' );
                res.status( 400 );
                res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
                res.end();
              }else{
                res.end( buf, 'binary' );
              }
            });
          }
        }else{
          res.status( 400 );
          res.write( JSON.stringify( { status: false, message: 'No attachment found.' }, 2, null ) );
          res.end();
        }
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});

app.get( '/docs', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  console.log( 'GET /docs' );

  if( db ){
    db.get( settings.db_name, '_design/library/_view/bytimestamp', {} ).then( function( data, headers, status ){
      //console.log( data );
      if( data && data.data ){
        var body = data.data.rows;
        res.write( JSON.stringify( { status: true, docs: body }, 2, null ) );
        res.end();
      }else{
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: 'failed to get documents.' }, 2, null ) );
        res.end();
      }
    }).catch( function( err ){
      console.log( err );
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
      res.end();
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});

app.delete( '/doc/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var id = req.params.id;
  console.log( 'DELETE /doc/' + id );

  if( db ){
    db.get( settings.db_name, id ).then( function( doc, headers, status ){
      console.log( doc );

      db.del( settings.db_name, id, doc.data._rev ).then( function( data, headers, status ){
        console.log( data );
        res.write( JSON.stringify( { status: true, doc: data }, 2, null ) );
        res.end();
      }).catch( function( err ){
        console.log( err );
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      });
    }).catch( function( err ){
      console.log( err );
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
      res.end();
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});


/*
 You need to create search index 'design/search' with name 'newSearch' in your Cloudant DB before executing this API.
 */
app.get( '/search', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  console.log( 'GET /search' );

  if( db ){
    var q = req.query.q;
    if( q ){
      if( settings.isCloudant ){
        //. Cloudant で search
        //. https://console.bluemix.net/docs/services/Cloudant/api/search.html#search
        //.  GET /$DATABASE/_design/$DDOC/_search/$INDEX_NAME?include_docs=true\&query="*:*"\&limit=1
        var option = {
          method: 'GET',
          url: settings.db_protocol + '://'
            + ( settings.db_username ? settings.db_username + ':' : '' )
            + ( settings.db_password ? settings.db_password + '@' : '' )
            + settings.db_host + ':' + settings.db_port
            + '/' + settings.db_name 
            + '/_design/library/_search/newSearch?include_docs=true&query=' + q
        };
        request( option, ( err0, res0, body0 ) => {
          //. couchdb に対して無理やり実行した場合、
          //.  err0 = null
          //.  body0 = {"error":"not_found","reason":"Document is missing attachment"}
          if( err0 ){
            res.status( 400 );
            res.write( JSON.stringify( { status: false, message: err0 }, 2, null ) );
            res.end();
          }else{
            var body = JSON.parse( body0 );
            res.write( JSON.stringify( { status: true, result: body.rows }, 2, null ) );
            res.end();
          }
        });
/*
        db.search( 'library', 'newSearch', { q: q }, function( err, body ){
          if( err ){
            res.status( 400 );
            res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
            res.end();
          }else{
            res.write( JSON.stringify( { status: true, result: body }, 2, null ) );
            res.end();
          }
        });
*/
      }else{
        //. Apache CouchDB で search
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: 'Not implemented yet( for CouchDB).' }, 2, null ) );
        res.end();
      }
    }else{
      res.status( 400 );
      res.write( JSON.stringify( { status: false, message: 'parameter: q is required.' }, 2, null ) );
      res.end();
    }
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});


app.post( '/reset', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  console.log( 'POST /reset' );

  if( db ){
    db.get( settings.db_name, '_design/library/_view/bytimestamp', {} ).then( function( data, headers, status ){
      //console.log( data );
      if( data && data.data ){
        var docs = data.data.rows;
        //console.log( docs );
        docs.forEach( function( doc ){
          db.del( settings.db_name, doc.value._id, doc.value._rev ).then( function( data, headers, status ){
            //console.log( data );
          }).catch( function( err ){
            //console.log( err );
          });
        });
      }
    });

    //. Apache CouchDB で reset
    res.write( JSON.stringify( { status: true }, 2, null ) );
    res.end();
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});


function deleteTree( ddoc, prev_docs ){
  var id = ddoc.id;
  var hash = ddoc.hash;
  deleteDocument( id );
  var docs = prev_docs[hash];
  docs.forEach( function( doc ){
    deleteTree( doc );
  });
}

function deleteDocument( doc_id ){
  console.log( "deleting document: " + doc_id );
  db.get( doc_id, function( err, data ){
    if( !err ){
      db.destroy( id, data._rev, function( err, body ){
      });
    }
  });
}

function sortDocuments( _docs ){
  var docs = [];
  for( var i = 0; i < _docs.length; i ++ ){
    var _doc = _docs[i];
    if( 'timestamp' in _doc ){
      var b = false;
      for( var j = 0; j < docs.length && !b; j ++ ){
        if( docs[j].timestamp > _doc.timestamp ){
          docs.splice( j, 0, _doc );
          b = true;
        }
      }
      if( !b ){
        docs.push( _doc );
      }
    }
  }

  return docs;
}

function createDesignDocument(){
  if( db ){
    var search_index_function = 'function (doc) { index( "default", doc._id ); }';
    if( settings.search_fields ){
      search_index_function = 'function (doc) { index( "default", ' + settings.search_fields + '.join( " " ) ); }';
    }

    //. デザインドキュメント作成
    var design_doc = {
      _id: "_design/library",
      language: "javascript",
      views: {
        bytimestamp: {
          map: "function (doc) { if( doc.timestamp ){ emit(doc.timestamp, doc); } }"
        }
      },
      indexes: {
        newSearch: {
          "analyzer": settings.search_analyzer,
          "index": search_index_function
        }
      }
    };

    db.insert( settings.db_name, design_doc ).then( function( data, headers, status ){
      console.log( 'design document successfully created.')
      console.log( data );
    }).catch( function( err ){
      console.log( 'exception catched:' );
      console.log( err );
    });
  }else{
    console.log( 'db is not initialized.' );
  }
}



var port = settings.app_port || appEnv.port || 3000;
app.listen( port );
console.log( 'server started on ' + port );
