#!/usr/bin/env node

/**
 * Module dependencies.
 */

var fs = require('fs')
  , program = require('commander')
  , path = require('path')
  , basename = path.basename
  , dirname = path.dirname
  , resolve = path.resolve
  , exists = fs.existsSync || path.existsSync
  , join = path.join
  , monocle = require('monocle')()
  , mkdirp = require('mkdirp')
  , hamlet = require('../lib/hamlet').hamlet;

// hamlet options

var options = {};

// options

program
  .version(require('../package.json').version)
  .usage('[options] [dir|file ...]')
  // .option('-O, --obj <str>', 'javascript options object')
  .option('-o, --out <dir>', 'output the compiled html to <dir>')
  .option('-p, --path <path>', 'filename used to resolve includes')
  // .option('-P, --pretty', 'compile pretty html output')
  // .option('-c, --client', 'compile function for client-side runtime.js')
  .option('-D, --no-debug', 'compile without debugging (smaller functions)')
  .option('-w, --watch', 'watch files for changes and automatically re-render')

program.on('--help', function(){
  console.log('  Examples:');
  console.log('');
  console.log('    # translate hamlet the templates dir');
  console.log('    $ hamlet templates');
  console.log('');
  console.log('    # create {foo,bar}.html');
  console.log('    $ hamlet {foo,bar}.hamlet');
  console.log('');
  console.log('    # hamlet over stdio');
  console.log('    $ hamlet < my.hamlet > my.html');
  console.log('');
  console.log('    # hamlet over stdio');
  console.log('    $ echo "h1 hamlet!" | hamlet');
  console.log('');
  console.log('    # foo, bar dirs rendering to /tmp');
  console.log('    $ hamlet foo bar --out /tmp ');
  console.log('');
});

program.parse(process.argv);

// options given, parse them

if (program.obj) {
  if (exists(program.obj)) {
    options = JSON.parse(fs.readFileSync(program.obj));
  } else {
    options = eval('(' + program.obj + ')');
  }
}

// --filename

if (program.path) options.filename = program.path;

// --no-debug

options.compileDebug = program.debug;

// --client

options.client = program.client;

// --pretty

options.pretty = program.pretty;

// --watch

options.watch = program.watch;

// left-over args are file paths

var files = program.args;

// compile files

if (files.length) {
  console.log();
  files.forEach(renderFile);
  if (options.watch) {
    monocle.watchFiles({
      files: files,
      listener: function(file) {
        renderFile(file.absolutePath);
      }
    });
  }
  process.on('exit', function () {
    console.log();
  });
// stdio
} else {
  stdin();
}

/**
 * Compile from stdin.
 */

function stdin() {
  var buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', function(chunk){ buf += chunk; });
  process.stdin.on('end', function(){
    process.stdout.write(hamlet(buf, {}) + "\n");
  }).resume();
}

/**
 * Process the given path, compiling the jade files found.
 * Always walk the subdirectories.
 */

function renderFile(path) {
  var re = /\.jade$/;
  fs.lstat(path, function(err, stat) {
    if (err) throw err;
    // Found jade file
    if (stat.isFile() && re.test(path)) {
      fs.readFile(path, 'utf8', function(err, str){
        if (err) throw err;
        options.filename = path;
        var extname = options.client ? '.js' : '.html';
        path = path.replace(re, extname);
        if (program.out) path = join(program.out, basename(path));
        var dir = resolve(dirname(path));
        mkdirp(dir, 0755, function(err){
          if (err) throw err;
          try {
            fs.writeFile(path, hamlet(str, {}), function(err){
              if (err) throw err;
              console.log('  \033[90mrendered \033[36m%s\033[0m', path);
            });
          } catch (e) {
            if (options.watch) {
              console.error(e.stack || e.message || e);
            } else {
              throw e
            }
          }
        });
      });
    // Found directory
    } else if (stat.isDirectory()) {
      fs.readdir(path, function(err, files) {
        if (err) throw err;
        files.map(function(filename) {
          return path + '/' + filename;
        }).forEach(renderFile);
      });
    }
  });
}
