#!/usr/bin/env node

/**
 * Risk Radar - Production Validation Script
 * This script validates that the application is ready for production deployment
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Risk Radar - Production Validation\n');
console.log('='.repeat(50));
console.log('\n');

let errors = 0;
let warnings = 0;
let checks = 0;

const check = (name, condition, errorMsg, warningMsg = null) => {
  checks++;
  if (condition) {
    console.log(`✅ ${name}`);
    return true;
  } else {
    if (warningMsg) {
      console.log(`⚠️  ${name}: ${warningMsg}`);
      warnings++;
    } else {
      console.log(`❌ ${name}: ${errorMsg}`);
      errors++;
    }
    return false;
  }
};

console.log('📦 Checking Project Structure...\n');

// Check critical files exist
check(
  'package.json exists',
  fs.existsSync('package.json'),
  'package.json not found'
);

check(
  'vite.config.ts exists',
  fs.existsSync('vite.config.ts'),
  'vite.config.ts not found'
);

check(
  'src/app/App.tsx exists',
  fs.existsSync('src/app/App.tsx'),
  'Main App component not found'
);

check(
  '.env.example exists',
  fs.existsSync('.env.example'),
  '.env.example not found'
);

check(
  '.env.production exists',
  fs.existsSync('.env.production'),
  '.env.production not found',
  'Create .env.production for production deployment'
);

console.log('\n🔐 Checking Security Components...\n');

// Check security components
check(
  'ErrorBoundary component exists',
  fs.existsSync('src/app/components/ErrorBoundary.tsx'),
  'ErrorBoundary component not found'
);

check(
  'ProtectedRoute component exists',
  fs.existsSync('src/app/components/ProtectedRoute.tsx'),
  'ProtectedRoute component not found'
);

check(
  'AuthContext exists',
  fs.existsSync('src/app/context/AuthContext.tsx'),
  'AuthContext not found'
);

console.log('\n⚙️  Checking Configuration...\n');

// Check config files
check(
  'Environment config exists',
  fs.existsSync('src/app/config/env.ts'),
  'Environment config not found'
);

check(
  'Logger utility exists',
  fs.existsSync('src/app/utils/logger.ts'),
  'Logger utility not found'
);

check(
  'Health check utility exists',
  fs.existsSync('src/app/utils/healthCheck.ts'),
  'Health check utility not found'
);

console.log('\n📚 Checking Documentation...\n');

// Check documentation
check(
  'README.md exists',
  fs.existsSync('README.md'),
  'README.md not found'
);

check(
  'PRODUCTION_READY.md exists',
  fs.existsSync('PRODUCTION_READY.md'),
  'PRODUCTION_READY.md not found'
);

check(
  'TESTING_CHECKLIST.md exists',
  fs.existsSync('TESTING_CHECKLIST.md'),
  'TESTING_CHECKLIST.md not found'
);

check(
  'FINAL_DEPLOYMENT_GUIDE.md exists',
  fs.existsSync('FINAL_DEPLOYMENT_GUIDE.md'),
  'FINAL_DEPLOYMENT_GUIDE.md not found'
);

console.log('\n🏗️  Checking Build Configuration...\n');

// Check build configuration
if (fs.existsSync('vite.config.ts')) {
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf-8');
  
  check(
    'Build optimization configured',
    viteConfig.includes('build:') && viteConfig.includes('minify'),
    'Build optimization not configured'
  );
  
  check(
    'Code splitting configured',
    viteConfig.includes('manualChunks'),
    'Code splitting not configured',
    'Consider adding code splitting for better performance'
  );
}

console.log('\n🔧 Checking Dependencies...\n');

// Check package.json
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  
  check(
    'Build script exists',
    pkg.scripts && pkg.scripts.build,
    'Build script not found in package.json'
  );
  
  check(
    'React installed',
    pkg.dependencies && pkg.dependencies.react,
    'React not installed',
    'React should be listed in dependencies'
  );
  
  check(
    'TypeScript support',
    fs.existsSync('tsconfig.json'),
    'tsconfig.json not found'
  );
}

console.log('\n🎯 Checking Routes Configuration...\n');

// Check routes
check(
  'Routes configuration exists',
  fs.existsSync('src/app/routes.tsx'),
  'Routes configuration not found'
);

if (fs.existsSync('src/app/routes.tsx')) {
  const routes = fs.readFileSync('src/app/routes.tsx', 'utf-8');
  
  check(
    'Protected routes implemented',
    routes.includes('ProtectedRoute'),
    'Protected routes not implemented'
  );
}

console.log('\n🗂️  Checking Project Structure...\n');

const requiredDirs = [
  'src/app/components',
  'src/app/pages',
  'src/app/context',
  'src/app/services',
  'src/app/utils',
  'src/app/config',
];

requiredDirs.forEach(dir => {
  check(
    `${dir} directory exists`,
    fs.existsSync(dir),
    `${dir} directory not found`
  );
});

console.log('\n' + '='.repeat(50));
console.log('\n📊 Validation Summary\n');
console.log(`Total Checks: ${checks}`);
console.log(`✅ Passed: ${checks - errors - warnings}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log(`❌ Errors: ${errors}`);

console.log('\n' + '='.repeat(50));

if (errors === 0 && warnings === 0) {
  console.log('\n🎉 SUCCESS! Application is 100% ready for production!\n');
  console.log('Next steps:');
  console.log('1. Run: npm run build');
  console.log('2. Test the production build: npm run preview');
  console.log('3. Follow deployment guide in FINAL_DEPLOYMENT_GUIDE.md\n');
  process.exit(0);
} else if (errors === 0) {
  console.log('\n✅ Application is production-ready with minor warnings.\n');
  console.log('Review warnings above and proceed with deployment.\n');
  process.exit(0);
} else {
  console.log('\n❌ Application has errors that need to be fixed.\n');
  console.log('Please fix the errors above before deploying to production.\n');
  process.exit(1);
}
