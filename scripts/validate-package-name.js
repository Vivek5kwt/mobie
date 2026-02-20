#!/usr/bin/env node

/**
 * Validates package name format
 * Package names must follow Java package naming conventions
 */

const PACKAGE_NAME = process.env.PACKAGE_NAME || process.argv[2];

if (!PACKAGE_NAME) {
  console.error('❌ Package name is required');
  console.log('Usage: node scripts/validate-package-name.js <package_name>');
  process.exit(1);
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
  process.exit(0);
} else {
  console.error('❌ Package name validation failed:\n');
  errors.forEach(error => console.error(error));
  console.error('\nExample valid package names:');
  console.error('  - com.mobidrag.builder.123');
  console.error('  - com.mycompany.myapp');
  console.error('  - io.example.app123');
  process.exit(1);
}
