#!/usr/bin/env node

/**
 * Deployment Status Checker
 * 
 * This script checks the status of the staging deployment by querying
 * Kubernetes resources and service health endpoints.
 * 
 * Usage:
 *   npm run deploy:check
 */

const { execSync } = require('child_process');
const fs = require('fs');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class DeploymentChecker {
  constructor() {
    this.envFile = '.env.staging';
    this.env = {};
    this.namespace = 'social-proof-system';
    
    this.services = [
      'integrations',
      'notification-stream',
      'notifications',
      'users',
      'analytics',
      'billing'
    ];
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  error(message) {
    this.log(`❌ ${message}`, 'red');
  }

  success(message) {
    this.log(`✅ ${message}`, 'green');
  }

  warning(message) {
    this.log(`⚠️  ${message}`, 'yellow');
  }

  info(message) {
    this.log(`ℹ️  ${message}`, 'blue');
  }

  execCommand(command, options = {}) {
    try {
      const result = execSync(command, { 
        encoding: 'utf8', 
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options 
      });
      return result.trim();
    } catch (error) {
      if (!options.allowFailure) {
        return null;
      }
      return null;
    }
  }

  loadEnvironmentVariables() {
    if (!fs.existsSync(this.envFile)) {
      this.warning(`Environment file ${this.envFile} not found, using defaults`);
      return;
    }

    const envContent = fs.readFileSync(this.envFile, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        this.env[key.trim()] = value.trim();
      }
    }
  }

  checkKubernetesConnection() {
    this.info('Checking Kubernetes connection...');
    
    try {
      const clusterInfo = this.execCommand('kubectl cluster-info', { silent: true });
      if (clusterInfo) {
        this.success('Connected to Kubernetes cluster');
        return true;
      }
    } catch (error) {
      this.error('Cannot connect to Kubernetes cluster');
      this.info('Run: gcloud container clusters get-credentials <cluster-name> --region <region>');
      return false;
    }
    return false;
  }

  checkNamespace() {
    this.info(`Checking namespace: ${this.namespace}`);
    
    const namespaces = this.execCommand('kubectl get namespaces -o name', { silent: true });
    if (namespaces && namespaces.includes(`namespace/${this.namespace}`)) {
      this.success(`Namespace ${this.namespace} exists`);
      return true;
    } else {
      this.error(`Namespace ${this.namespace} not found`);
      return false;
    }
  }

  checkPods() {
    this.info('Checking pod status...');
    
    try {
      const pods = this.execCommand(`kubectl get pods -n ${this.namespace} -o wide`, { silent: true });
      if (!pods) {
        this.error('No pods found');
        return false;
      }

      console.log('\n📦 Pod Status:');
      console.log('==============');
      console.log(pods);
      
      // Check for running pods
      const lines = pods.split('\n').slice(1); // Skip header
      let runningCount = 0;
      let totalCount = 0;
      
      for (const line of lines) {
        if (line.trim()) {
          totalCount++;
          if (line.includes('Running') && line.includes('1/1')) {
            runningCount++;
          }
        }
      }
      
      if (runningCount === totalCount && totalCount > 0) {
        this.success(`All ${totalCount} pods are running`);
        return true;
      } else {
        this.warning(`${runningCount}/${totalCount} pods are running`);
        return false;
      }
      
    } catch (error) {
      this.error('Failed to check pod status');
      return false;
    }
  }

  checkServices() {
    this.info('Checking service status...');
    
    try {
      const services = this.execCommand(`kubectl get services -n ${this.namespace}`, { silent: true });
      if (!services) {
        this.error('No services found');
        return false;
      }

      console.log('\n🌐 Service Status:');
      console.log('==================');
      console.log(services);
      
      return true;
      
    } catch (error) {
      this.error('Failed to check service status');
      return false;
    }
  }

  checkIngress() {
    this.info('Checking ingress status...');
    
    try {
      const ingress = this.execCommand(`kubectl get ingress -n ${this.namespace}`, { silent: true, allowFailure: true });
      if (ingress && ingress.trim()) {
        console.log('\n🌍 Ingress Status:');
        console.log('==================');
        console.log(ingress);
        return true;
      } else {
        this.warning('No ingress resources found');
        return false;
      }
      
    } catch (error) {
      this.warning('No ingress resources found');
      return false;
    }
  }

  checkConfigMaps() {
    this.info('Checking configuration...');
    
    try {
      const configMaps = this.execCommand(`kubectl get configmaps -n ${this.namespace}`, { silent: true });
      if (configMaps) {
        console.log('\n⚙️  ConfigMaps:');
        console.log('===============');
        console.log(configMaps);
        return true;
      }
    } catch (error) {
      this.warning('Failed to check configmaps');
    }
    return false;
  }

  checkSecrets() {
    this.info('Checking secrets...');
    
    try {
      const secrets = this.execCommand(`kubectl get secrets -n ${this.namespace}`, { silent: true });
      if (secrets) {
        console.log('\n🔐 Secrets:');
        console.log('===========');
        console.log(secrets);
        return true;
      }
    } catch (error) {
      this.warning('Failed to check secrets');
    }
    return false;
  }

  checkRecentEvents() {
    this.info('Checking recent events...');
    
    try {
      const events = this.execCommand(`kubectl get events -n ${this.namespace} --sort-by='.lastTimestamp' | tail -10`, { silent: true });
      if (events) {
        console.log('\n📋 Recent Events:');
        console.log('==================');
        console.log(events);
        return true;
      }
    } catch (error) {
      this.warning('Failed to check events');
    }
    return false;
  }

  async run() {
    try {
      this.log('\n🔍 Checking Deployment Status', 'cyan');
      this.log('==============================\n', 'cyan');
      
      this.loadEnvironmentVariables();
      
      // Check prerequisites
      if (!this.checkKubernetesConnection()) {
        process.exit(1);
      }
      
      if (!this.checkNamespace()) {
        process.exit(1);
      }
      
      // Check deployment components
      const checks = [
        this.checkPods(),
        this.checkServices(),
        this.checkIngress(),
        this.checkConfigMaps(),
        this.checkSecrets()
      ];
      
      const passedChecks = checks.filter(Boolean).length;
      const totalChecks = checks.length;
      
      // Show recent events
      this.checkRecentEvents();
      
      // Summary
      this.log('\n📊 Deployment Summary', 'cyan');
      this.log('=====================', 'cyan');
      
      if (passedChecks === totalChecks) {
        this.success(`All checks passed (${passedChecks}/${totalChecks})`);
        this.success('Deployment appears to be healthy! 🎉');
      } else {
        this.warning(`${passedChecks}/${totalChecks} checks passed`);
        this.warning('Some issues detected. Check the output above for details.');
      }
      
      this.log('\n💡 Useful Commands:', 'blue');
      this.log('===================', 'blue');
      this.info(`kubectl logs -n ${this.namespace} -l app=<service-name> --tail=50`);
      this.info(`kubectl describe pod -n ${this.namespace} <pod-name>`);
      this.info(`kubectl port-forward -n ${this.namespace} service/<service-name> 8080:80`);
      this.info(`kubectl get all -n ${this.namespace}`);
      
    } catch (error) {
      this.error(`Status check failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run the status check
if (require.main === module) {
  const checker = new DeploymentChecker();
  checker.run().catch(console.error);
}

module.exports = DeploymentChecker; 