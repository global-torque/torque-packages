import { debugLog } from '../debug.ts';
import { resolveComponentName } from './analyticsVmComponent.ts';

/**
 * Extracts component name from error stack with enhanced analysis for API errors.
 */
export const resolveComponentNameFromStack = (stack?: string): string | undefined => {
  if (!stack) {
    debugLog('[Stack Analysis] No stack provided');
    return undefined;
  }

  debugLog('[Stack Analysis] Analyzing stack:', stack.substring(0, 200) + '...');

  // Simplified pattern matching - just look for any PascalCase names
  const simplePatterns = [
    // Vue component files
    /([A-Z][A-Za-z0-9_-]+)\.vue/,
    // TypeScript files
    /([A-Z][A-Za-z0-9_-]+)\.ts/,
    // Function names in stack
    /at\s+([A-Z][A-Za-z0-9_-]+)/,
    // Component names in error messages
    /error\s+in\s+([A-Z][A-Za-z0-9_-]+)/i,
  ];

  // Try each pattern
  for (let i = 0; i < simplePatterns.length; i++) {
    const pattern = simplePatterns[i];
    const match = stack.match(pattern);
    if (match?.[1]) {
      const candidate = match[1];
      debugLog(`[Stack Analysis] Pattern ${i + 1} matched: "${candidate}"`);
      if (isValidComponentName(candidate, stack)) {
        debugLog(`[Stack Analysis] ✅ Valid component found: "${candidate}"`);
        return candidate;
      } else {
        debugLog(`[Stack Analysis] ❌ Invalid component name: "${candidate}"`);
      }
    }
  }

  debugLog('[Stack Analysis] ❌ No component name found in stack');
  return undefined;
};

/**
 * Specialized function to extract component name from API errors with enhanced analysis.
 */
export const resolveComponentNameFromAPIError = (
  error: Error | undefined,
  apiClient?: any,
): string | undefined => {
  if (!error) {
    debugLog('[API Error Analysis] No error provided');
    return undefined;
  }

  debugLog('[API Error Analysis] Analyzing API error:', error.message);

  // First try to get from API client context if available
  if (apiClient && (apiClient as any).componentContext) {
    debugLog(
      '[API Error Analysis] ✅ Found component context in API client:',
      (apiClient as any).componentContext,
    );
    return (apiClient as any).componentContext;
  }

  // Enhanced stack analysis for API errors
  const stack = error.stack || '';
  debugLog('[API Error Analysis] Analyzing stack for API patterns...');

  // Simplified API pattern matching
  const simpleApiPatterns = [
    // Any method calls
    /([A-Z][A-Za-z0-9_-]+)\.(?:get|post|put|patch|delete|set|create|update|remove|fetch|load|save|handle|submit)/,
    // Repository/Store patterns
    /([A-Z][A-Za-z0-9_-]+)(?:Repository|Store)\./,
    // Use patterns
    /use(?:Repository)?([A-Z][A-Za-z0-9_-]+)/,
  ];

  for (let i = 0; i < simpleApiPatterns.length; i++) {
    const pattern = simpleApiPatterns[i];
    const match = stack.match(pattern);
    if (match?.[1]) {
      debugLog(`[API Error Analysis] API pattern ${i + 1} matched: "${match[1]}"`);
      if (isValidComponentName(match[1], stack)) {
        debugLog(`[API Error Analysis] ✅ Valid API component found: "${match[1]}"`);
        return match[1];
      } else {
        debugLog(`[API Error Analysis] ❌ Invalid API component name: "${match[1]}"`);
      }
    }
  }

  // Fall back to general stack analysis
  debugLog('[API Error Analysis] Falling back to general stack analysis...');
  return resolveComponentNameFromStack(stack);
};

/**
 * Advanced stack trace analysis specifically for API errors with context awareness.
 */
export const analyzeAPIErrorStack = (error: Error | undefined): {
  componentName?: string;
  apiMethod?: string;
  repositoryName?: string;
  context?: string;
} => {
  if (!error?.stack) {
    debugLog('[API Stack Analysis] No stack provided');
    return {};
  }

  debugLog('[API Stack Analysis] Analyzing API error stack...');
  const stack = error.stack;
  const result: any = {};

  // Extract component name using general stack analysis
  debugLog('[API Stack Analysis] Using general stack analysis for component detection...');
  const componentName = resolveComponentNameFromStack(stack);
  if (componentName) {
    result.componentName = componentName;
    debugLog('[API Stack Analysis] ✅ Component found:', componentName);
  }

  // Extract API method information
  const apiMethodPatterns = [
    /\.(get|post|put|patch|delete|options)\s*\(/,
    /(?:handle|submit|save|load|fetch|get|post|put|patch|delete)\w*\s*\(/,
  ];

  for (let i = 0; i < apiMethodPatterns.length; i++) {
    const pattern = apiMethodPatterns[i];
    const match = stack.match(pattern);
    if (match?.[1]) {
      result.apiMethod = match[1];
      debugLog(`[API Stack Analysis] ✅ API method found with pattern ${i + 1}:`, match[1]);
      break;
    }
  }

  // Extract repository name - simplified patterns
  const simpleRepoPatterns = [
    /([A-Z][A-Za-z0-9_-]+)(?:Repository|Store)\./,
    /use(?:Repository)?([A-Z][A-Za-z0-9_-]+)/,
    /data\/(?:repository|service)\/([A-Z][A-Za-z0-9_-]+)/,
  ];

  for (let i = 0; i < simpleRepoPatterns.length; i++) {
    const pattern = simpleRepoPatterns[i];
    const match = stack.match(pattern);
    if (match?.[1]) {
      result.repositoryName = match[1];
      debugLog(`[API Stack Analysis] ✅ Repository found with pattern ${i + 1}:`, match[1]);
      break;
    }
  }

  // Extract context information
  const contextPatterns = [
    /async\s+([A-Z][A-Za-z0-9_-]+)/,
    /await\s+([A-Z][A-Za-z0-9_-]+)/,
    /Promise\.(?:resolve|reject|all|race)/,
  ];

  for (let i = 0; i < contextPatterns.length; i++) {
    const pattern = contextPatterns[i];
    const match = stack.match(pattern);
    if (match?.[1]) {
      result.context = match[1];
      debugLog(`[API Stack Analysis] ✅ Context found with pattern ${i + 1}:`, match[1]);
      break;
    }
  }

  debugLog('[API Stack Analysis] Final result:', result);
  return result;
};

/**
 * Comprehensive component name resolution for API errors.
 * Combines all analysis methods for the best possible result.
 */
export const resolveComponentNameForAPIError = (
  error: Error | undefined,
  vm: any,
  apiClient?: any,
  fallback: string = 'Unknown Component',
): {
  componentName: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'api-context' | 'stack-analysis' | 'vm-analysis' | 'fallback';
  additionalInfo?: {
    apiMethod?: string;
    repositoryName?: string;
    context?: string;
  };
} => {
  debugLog('[Comprehensive Analysis] Starting comprehensive component name resolution...');

  // Try API client context first (highest confidence)
  if (apiClient && (apiClient as any).componentContext) {
    debugLog('[Comprehensive Analysis] ✅ Using API client context:', (apiClient as any).componentContext);
    return {
      componentName: (apiClient as any).componentContext,
      confidence: 'high',
      source: 'api-context',
    };
  }

  // Try API-specific stack analysis
  debugLog('[Comprehensive Analysis] Trying API-specific stack analysis...');
  const apiAnalysis = analyzeAPIErrorStack(error);
  if (apiAnalysis.componentName && isValidComponentName(apiAnalysis.componentName, error?.stack)) {
    debugLog('[Comprehensive Analysis] ✅ API analysis found component:', apiAnalysis.componentName);
    return {
      componentName: apiAnalysis.componentName,
      confidence: 'high',
      source: 'stack-analysis',
      additionalInfo: {
        apiMethod: apiAnalysis.apiMethod,
        repositoryName: apiAnalysis.repositoryName,
        context: apiAnalysis.context,
      },
    };
  }

  // Try general API error analysis
  debugLog('[Comprehensive Analysis] Trying general API error analysis...');
  const fromAPI = resolveComponentNameFromAPIError(error, apiClient);
  if (fromAPI && isValidComponentName(fromAPI, error?.stack)) {
    debugLog('[Comprehensive Analysis] ✅ General API analysis found component:', fromAPI);
    return {
      componentName: fromAPI,
      confidence: 'medium',
      source: 'stack-analysis',
    };
  }

  // Try general stack analysis
  debugLog('[Comprehensive Analysis] Trying general stack analysis...');
  const fromStack = resolveComponentNameFromStack(error?.stack);
  if (fromStack && isValidComponentName(fromStack, error?.stack)) {
    debugLog('[Comprehensive Analysis] ✅ General stack analysis found component:', fromStack);
    return {
      componentName: fromStack,
      confidence: 'medium',
      source: 'stack-analysis',
    };
  }

  // Fall back to VM analysis
  debugLog('[Comprehensive Analysis] Trying VM analysis...');
  const fromVm = resolveComponentName(vm, fallback);
  if (fromVm && isValidComponentName(fromVm)) {
    debugLog('[Comprehensive Analysis] ✅ VM analysis found component:', fromVm);
    return {
      componentName: fromVm,
      confidence: 'low',
      source: 'vm-analysis',
    };
  }

  // Final fallback
  debugLog('[Comprehensive Analysis] ❌ Using fallback component name:', fallback);
  return {
    componentName: fallback,
    confidence: 'low',
    source: 'fallback',
  };
};

/**
 * Checks if a name is a valid Vue component (not a utility).
 * Now allows all names except those from excluded paths.
 */
const isValidComponentName = (name?: string, stack?: string): boolean => {
  if (!name) return false;

  const trimmed = name.trim();
  if (!trimmed) return false;

  debugLog(`[Validation] Checking component name: "${name}"`);

  // Basic validation - exclude obvious utility names
  const bannedNames = [
    'event',
    'listener',
    'handler',
    'callback',
    'function',
    'method',
    'anonymous',
    'eval',
    'proxy',
    'object',
    'promise',
    'async',
    'await',
    'then',
    'catch',
    'finally',
    'resolve',
    'reject',
  ];

  if (bannedNames.includes(trimmed.toLowerCase())) {
    debugLog(`[Validation] ❌ Name "${name}" is a banned utility name`);
    return false;
  }

  // Exclude utility class patterns
  const utilityPatterns = [
    /^EventListener$/i,
    /^EventTarget$/i,
    /^EventSource$/i,
    /^EventEmitter$/i,
    /^EventBus$/i,
    /^EventDispatcher$/i,
    /^EventManager$/i,
    /^EventRegistry$/i,
    /^EventStore$/i,
    /^EventRepository$/i,
    /^EventService$/i,
    /^EventClient$/i,
    /^EventHandler$/i,
    /^EventInterceptor$/i,
    /^EventAdapter$/i,
    /^EventProvider$/i,
    /^EventFactory$/i,
    /^EventBuilder$/i,
    /^EventHelper$/i,
    /^EventUtil$/i,
    /^EventTool$/i,
  ];

  if (utilityPatterns.some((pattern) => pattern.test(trimmed))) {
    debugLog(`[Validation] ❌ Name "${name}" matches utility class pattern`);
    return false;
  }

  // Must be PascalCase (starts with uppercase)
  if (!/^[A-Z]/.test(trimmed)) {
    debugLog(`[Validation] ❌ Name "${name}" doesn't start with uppercase`);
    return false;
  }

  // Must be at least 3 characters
  if (trimmed.length < 3) {
    debugLog(`[Validation] ❌ Name "${name}" is too short`);
    return false;
  }

  // Only exclude names that come from specific non-component paths
  if (stack) {
    const lowerStack = stack.toLowerCase();
    const lowerName = name.toLowerCase();
    const excludePaths = [
      '/domain/',
      '/data/repository/',
      '/data/service/',
      '/data/analytics/',
      '/helpers/',
      '/utils/',
      '/services/',
      '/api/',
      '/client/',
      '/interceptors/',
      '/adapters/',
      '/handlers/',
    ];

    debugLog(`[Validation] Stack contains: ${lowerStack.substring(0, 100)}...`);
    debugLog(`[Validation] Looking for name "${lowerName}" in excluded paths...`);

    // Only exclude if the name is clearly from a utility file (not just mentioned in the stack)
    for (const path of excludePaths) {
      // Look for file paths that contain both the excluded path and the component name
      const filePathRegex = new RegExp(
        `[^\\s]*${path.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}[^\\s]*${lowerName}[^\\s]*\\.(ts|js|vue)`,
        'i',
      );
      if (filePathRegex.test(lowerStack)) {
        debugLog(`[Validation] ❌ Name "${name}" found in utility file path: ${path}`);
        return false;
      }
    }

    debugLog(`[Validation] ✅ Name "${name}" not found in any excluded paths`);
  }

  // Allow all other names that pass basic validation
  debugLog(`[Validation] ✅ Component name "${name}" is valid`);
  return true;
};

