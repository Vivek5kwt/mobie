#!/usr/bin/env node

/**
 * Fixes package name by prefixing numeric-only segments with "app"
 * This ensures all segments start with a lowercase letter (Android requirement)
 * 
 * Examples:
 *   com.mobidrag.builder.152 -> com.mobidrag.builder.app152
 *   com.example.123 -> com.example.app123
 *   com.mycompany.myapp123 -> com.mycompany.myapp123 (already valid)
 */

const PACKAGE_NAME = process.env.PACKAGE_NAME || process.argv[2];

if (!PACKAGE_NAME) {
  console.error('❌ Package name is required');
  console.log('Usage: node scripts/fix-package-name.js <package_name>');
  process.exit(1);
}

/**
 * Fixes package name by prefixing numeric-only segments with "app"
 * @param {string} packageName - The package name to fix
 * @returns {string} - Fixed package name
 */
function fixPackageName(packageName) {
  if (!packageName || packageName.length === 0) {
    return packageName;
  }

  // Split into segments
  const segments = packageName.split('.');
  
  // Fix each segment that starts with a number
  const fixedSegments = segments.map(segment => {
    // If segment starts with a number, prefix with "app"
    if (/^[0-9]/.test(segment)) {
      return `app${segment}`;
    }
    return segment;
  });
  
  return fixedSegments.join('.');
}

const originalName = PACKAGE_NAME;
const fixedName = fixPackageName(PACKAGE_NAME);

if (originalName !== fixedName) {
  // Log to stderr so stdout only contains the fixed name
  console.error(`🔧 Fixed package name:`);
  console.error(`   Original: ${originalName}`);
  console.error(`   Fixed:    ${fixedName}`);
  // Output fixed name to stdout for use in scripts (last line only)
  console.log(fixedName);
  process.exit(0);
} else {
  // Log to stderr so stdout only contains the package name
  console.error(`✅ Package name is already valid: ${originalName}`);
  // Output original name to stdout if no fix needed (last line only)
  console.log(originalName);
  process.exit(0);
}
