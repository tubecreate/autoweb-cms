const fs = require('fs');

const originalSymlinkSync = fs.symlinkSync;
fs.symlinkSync = function(target, path, type) {
  if (!type) {
    try {
      if (fs.statSync(target).isDirectory()) {
        type = 'junction';
      }
    } catch (e) {}
  }
  return originalSymlinkSync(target, path, type);
};

const originalSymlink = fs.symlink;
fs.symlink = function(target, path, type, callback) {
  if (typeof type === 'function') {
    callback = type;
    type = undefined;
  }
  if (!type) {
    try {
      if (fs.statSync(target).isDirectory()) {
        type = 'junction';
      }
    } catch (e) {}
  }
  return originalSymlink(target, path, type, callback);
};

try {
  const fsp = require('fs/promises');
  const originalPromiseSymlink = fsp.symlink;
  fsp.symlink = function(target, path, type) {
    if (!type) {
      try {
        if (fs.statSync(target).isDirectory()) {
          type = 'junction';
        }
      } catch (e) {}
    }
    return originalPromiseSymlink(target, path, type);
  };
} catch (e) {}
