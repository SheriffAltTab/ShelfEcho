function info() {
  return {
    node: process.version,
    execPath: process.execPath,
    modules: process.versions.modules,
    platform: process.platform,
    arch: process.arch,
  };
}

function print(title, value) {
  // eslint-disable-next-line no-console
  console.log(`${title}:`, value);
}

print('ShelfEcho doctor', '');
print('runtime', info());

try {
  // The most common local failure: native module ABI mismatch
  await import('better-sqlite3');
  print('better-sqlite3', 'OK (module loaded)');
} catch (err) {
  print('better-sqlite3', 'FAILED to load');
  // eslint-disable-next-line no-console
  console.error(err?.message || err);
  // eslint-disable-next-line no-console
  console.error(
    '\nFix: use the SAME Node.js version for install and run.\n' +
      'Then run (in server/):\n' +
      '  npm rebuild better-sqlite3\n' +
      'Or do a clean reinstall:\n' +
      '  rmdir /s /q node_modules\n' +
      '  del package-lock.json\n' +
      '  npm install\n',
  );
  process.exitCode = 1;
}

