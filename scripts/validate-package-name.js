#!/usr/bin/env node

/**
 * Validates package name format
 * Package names must follow Java package naming conventions
 */

/**
 * Fixes package name by prefixing numeric-only segments with "app"
 */
function fixPackageName(packageName) {
  if (!packageName || packageName.length === 0) {
    return packageName;
  }
  const segments = packageName.split('.');
  const fixedSegments = segments.map(segment => {
    if (/^[0-9]/.test(segment)) {
      return `app${segment}`;
    }
    return segment;
  });
  return fixedSegments.join('.');
}

let PACKAGE_NAME = process.env.PACKAGE_NAME || process.argv[2];

if (!PACKAGE_NAME) {
  console.error('❌ Package name is required');
  console.log('Usage: node scripts/validate-package-name.js <package_name>');
  process.exit(1);
}

// Auto-fix package name before validation
const originalPackageName = PACKAGE_NAME;
PACKAGE_NAME = fixPackageName(PACKAGE_NAME);

if (originalPackageName !== PACKAGE_NAME) {
  console.log(`🔧 Auto-fixed package name:`);
  console.log(`   Original: ${originalPackageName}`);
  console.log(`   Fixed:    ${PACKAGE_NAME}\n`);
}

// Validation rules
const rules = [
  {
    name: 'Must not be empty',
    test: (name) => name && name.length > 0,
    error: 'Package name cannot be empty'
  },
  {
    name: 'Must start with a letter',
    test: (name) => /^[a-z]/.test(name),
    error: 'Package name must start with a lowercase letter'
  },
  {
    name: 'Must contain only lowercase letters, numbers, and dots',
    test: (name) => /^[a-z0-9.]+$/.test(name),
    error: 'Package name can only contain lowercase letters, numbers, and dots'
  },
  {
    name: 'Cannot contain consecutive dots',
    test: (name) => !/\.\./.test(name),
    error: 'Package name cannot contain consecutive dots'
  },
  {
    name: 'Cannot start or end with a dot',
    test: (name) => !name.startsWith('.') && !name.endsWith('.'),
    error: 'Package name cannot start or end with a dot'
  },
  {
    name: 'Each segment must start with a letter',
    test: (name) => {
      const segments = name.split('.');
      return segments.every(seg => /^[a-z]/.test(seg));
    },
    error: 'Each package segment must start with a lowercase letter'
  },
  {
    name: 'Must have at least 2 segments',
    test: (name) => name.split('.').length >= 2,
    error: 'Package name must have at least 2 segments (e.g., com.example)'
  }
];

console.log(`🔍 Validating package name: ${PACKAGE_NAME}\n`);

let isValid = true;
const errors = [];

for (const rule of rules) {
  if (!rule.test(PACKAGE_NAME)) {
    isValid = false;
    errors.push(`❌ ${rule.name}: ${rule.error}`);
  } else {
    console.log(`✅ ${rule.name}`);
  }
}

console.log('');

if (isValid) {
  console.log('✅ Package name is valid!');
  // Output the fixed/validated package name for use in scripts
  console.log(`\n📦 Validated package name: ${PACKAGE_NAME}`);
  process.exit(0);
} else {
  console.error('❌ Package name validation failed:\n');
  errors.forEach(error => console.error(error));
  console.error('\nExample valid package names:');
  console.error('  - com.mobidrag.builder.app123');
  console.error('  - com.mycompany.myapp');
  console.error('  - io.example.app123');
  console.error('\n💡 Tip: Numeric-only segments are auto-prefixed with "app"');
  console.error('   Example: com.example.123 -> com.example.app123');
  process.exit(1);
}
