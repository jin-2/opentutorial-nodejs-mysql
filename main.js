require('dotenv').config();

const http = require('http');
const fs = require('fs');
const url = require('url');
const qs = require('querystring');
const template = require('./lib/template.js');
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const mysql = require('mysql');

const connection = mysql.createConnection({
  host: process.env.HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PW,
  database: process.env.DB,
});

connection.connect();

var app = http.createServer(function (request, response) {
  var _url = request.url;
  var queryData = url.parse(_url, true).query;
  var pathname = url.parse(_url, true).pathname;
  if (pathname === '/') {
    if (queryData.id === undefined) {
      connection.query('SELECT * FROM topic', function (error, data) {
        var title = 'Welcome';
        var description = 'Hello, Node.js';
        var list = template.list(data);
        var html = template.HTML(
          title,
          list,
          `<h2>${title}</h2>${description}`,
          `<a href="/create">create</a>`
        );
        response.writeHead(200);
        response.end(html);
      });
    } else {
      connection.query(
        `SELECT * FROM topic WHERE id=?`,
        [queryData.id],
        function (error, data) {
          if (error) {
            throw error;
          }
          var title = queryData.id;
          var sanitizedTitle = sanitizeHtml(data[0].title);
          var sanitizedDescription = sanitizeHtml(data[0].description, {
            allowedTags: ['h1'],
          });
          var list = template.list(data);
          var html = template.HTML(
            sanitizedTitle,
            list,
            `<h2>${sanitizedTitle}</h2>${sanitizedDescription}`,
            ` <a href="/create">create</a>
                    <a href="/update?id=${queryData.id}">update</a>
                    <form action="delete_process" method="post">
                      <input type="hidden" name="id" value="${sanitizedTitle}">
                      <input type="submit" value="delete">
                    </form>`
          );
          response.writeHead(200);
          response.end(html);
        }
      );
    }
  } else if (pathname === '/create') {
    connection.query('SELECT * FROM topic', function (error, data) {
      const title = 'WEB - create';
      const list = template.list(data);
      const html = template.HTML(
        title,
        list,
        `
          <form action="/create_process" method="post">
            <p><input type="text" name="title" placeholder="title"></p>
            <p>
              <textarea name="description" placeholder="description"></textarea>
            </p>
            <p>
              <input type="submit">
            </p>
          </form>
        `,
        ''
      );
      response.writeHead(200);
      response.end(html);
    });
  } else if (pathname === '/create_process') {
    let body = '';
    request.on('data', function (data) {
      body = body + data;
    });
    request.on('end', function () {
      var post = qs.parse(body);
      var title = post.title;
      var description = post.description;
      connection.query(
        `INSERT INTO topic (title, description, created, author_id) VALUES (?, ?, NOW(), ?)`,
        [title, description, 1],
        function (error, result) {
          response.writeHead(302, { Location: `/?id=${result.insertId}` });
          response.end();
        }
      );
    });
  } else if (pathname === '/update') {
    connection.query(
      `SELECT * FROM topic WHERE id=?`,
      [queryData.id],
      function (error, data) {
        var uid = queryData.id;
        var list = template.list(data);
        var html = template.HTML(
          data[0].title,
          list,
          `
              <form action="/update_process" method="post">
                <input type="hidden" name="id" value="${uid}">
                <p><input type="text" name="title" placeholder="title" value="${data[0].title}"></p>
                <p>
                  <textarea name="description" placeholder="description">${data[0].description}</textarea>
                </p>
                <p>
                  <input type="submit">
                </p>
              </form>
              `,
          `<a href="/create">create</a> <a href="/update?id=${uid}">update</a>`
        );
        response.writeHead(200);
        response.end(html);
      }
    );
  } else if (pathname === '/update_process') {
    var body = '';
    request.on('data', function (data) {
      body = body + data;
    });
    request.on('end', function () {
      var post = qs.parse(body);
      var id = post.id;
      var title = post.title;
      var description = post.description;
      connection.query(
        `UPDATE topic SET title=?, description=? WHERE id=?`,
        [title, description, id],
        function (error, data) {
          response.writeHead(302, { Location: `/?id=${id}` });
          response.end();
        }
      );
    });
  } else if (pathname === '/delete_process') {
    var body = '';
    request.on('data', function (data) {
      body = body + data;
    });
    request.on('end', function () {
      var post = qs.parse(body);
      var id = post.id;
      var filteredId = path.parse(id).base;
      fs.unlink(`data/${filteredId}`, function (error) {
        response.writeHead(302, { Location: `/` });
        response.end();
      });
    });
  } else {
    response.writeHead(404);
    response.end('Not found');
  }
});

// connection.end();

app.listen(3000);
