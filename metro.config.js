const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  server: {
    // Strip "multipart/mixed" from Accept and force identity encoding so
    // Metro sends a plain, uncompressed bundle response.
    // Fixes two OkHttp bugs on Android emulators with RN 0.82 + Metro 0.83:
    //   1. Chunked-encoding parse error from multipart responses
    //      ("Expected leading [0-9a-fA-F] character but was 0xd")
    //   2. GZip decompression failure (InflaterSource.refill exhausted)
    enhanceMiddleware: (middleware) => (req, res, next) => {
      if (req.headers) {
        // Remove multipart from Accept so Metro returns a plain response
        if (req.headers.accept) {
          req.headers.accept = req.headers.accept
            .split(',')
            .filter((t) => !t.trim().startsWith('multipart/mixed'))
            .join(',');
        }
        // Force identity encoding so Metro does not gzip the bundle
        req.headers['accept-encoding'] = 'identity';
      }
      return middleware(req, res, next);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
