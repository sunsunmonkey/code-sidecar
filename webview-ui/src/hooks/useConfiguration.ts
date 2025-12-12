/**
 * Custom hook for managing configuration state
 * Handles configuration loading, saving, validation, and operations
 * Requirements: 2.1, 2.2, 1.2 (optimized with debouncing)
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useVSCodeApi, useMessageListener } from './useVSCodeApi';
import type { UIConfiguration, ValidationErrors } from '../types/config';
import type { ConfigMessage, ConfigResponse } from '../types/messages';
import {
  validateUrl,
  validateModel,
  validateApiKey,
  validateTemperature,
  validateMaxTokens,
  validateMaxLoopCount,
  validateContextWindowSize,
} from '../utils/validation';
import { debounce } from '../utils/debounce';

/**
 * Configuration hook return type
 */
export interface UseConfigurationReturn {
  // State
  config: UIConfiguration | null;
  validationErrors: ValidationErrors;
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  testResult: { success: boolean; error?: string; responseTime?: number } | null;
  isFirstTime: boolean;

  // Actions
  updateConfig: (updates: Partial<UIConfiguration>) => void;
  updateApiConfig: (field: keyof UIConfiguration['api'], value: any) => void;
  updatePermissions: (field: keyof UIConfiguration['permissions'], value: boolean) => void;
  updateAdvanced: (field: keyof UIConfiguration['advanced'], value: any) => void;
  saveConfiguration: () => void;
  testConnection: () => void;
  validateAll: () => boolean;
}

/**
 * Hook for managing configuration state and operations
 * 
 * @returns Configuration state and action functions
 */
export function useConfiguration(): UseConfigurationReturn {
  const { postMessage } = useVSCodeApi();

  // State
  const [config, setConfig] = useState<UIConfiguration | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; responseTime?: number } | null>(null);
  const [isFirstTime, setIsFirstTime] = useState(false);

  /**
   * Validate a single field
   */
  const validateField = useCallback((field: string, value: any): string | undefined => {
    switch (field) {
      case 'baseUrl':
        return validateUrl(value);
      case 'model':
        return validateModel(value);
      case 'apiKey':
        return validateApiKey(value);
      case 'temperature':
        return validateTemperature(value);
      case 'maxTokens':
        return validateMaxTokens(value);
      case 'maxLoopCount':
        return validateMaxLoopCount(value);
      case 'contextWindowSize':
        return validateContextWindowSize(value);
      default:
        return undefined;
    }
  }, []);

  /**
   * Debounced validation function to reduce validation frequency
   * Requirement: 1.2, 2.2 - Performance optimization
   */
  const debouncedValidateField = useMemo(
    () => debounce((field: string, value: any) => {
      const error = validateField(field, value);
      setValidationErrors(prevErrors => ({
        ...prevErrors,
        [field]: error
      }));
    }, 300), // 300ms debounce delay
    [validateField]
  );

  /**
   * Validate all configuration fields
   * @returns true if all fields are valid, false otherwise
   */
  const validateAll = useCallback((): boolean => {
    if (!config) return false;

    const errors: ValidationErrors = {};

    // Validate API config
    errors.baseUrl = validateField('baseUrl', config.api.baseUrl);
    errors.model = validateField('model', config.api.model);
    errors.apiKey = validateField('apiKey', config.api.apiKey);
    errors.temperature = validateField('temperature', config.api.temperature);
    errors.maxTokens = validateField('maxTokens', config.api.maxTokens);

    // Validate advanced config
    errors.maxLoopCount = validateField('maxLoopCount', config.advanced.maxLoopCount);
    errors.contextWindowSize = validateField('contextWindowSize', config.advanced.contextWindowSize);

    setValidationErrors(errors);

    // Check if any errors exist
    return !Object.values(errors).some(error => error !== undefined);
  }, [config, validateField]);

  /**
   * Update configuration with partial updates
   */
  const updateConfig = useCallback((updates: Partial<UIConfiguration>) => {
    setConfig(prev => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });
  }, []);

  /**
   * Update API configuration field
   * Uses debounced validation to improve performance (Requirement: 1.2, 2.2)
   */
  const updateApiConfig = useCallback((field: keyof UIConfiguration['api'], value: any) => {
    setConfig(prev => {
      if (!prev) return null;
      
      const newConfig = {
        ...prev,
        api: { ...prev.api, [field]: value }
      };

      return newConfig;
    });

    // Debounced validation to reduce validation frequency
    debouncedValidateField(field, value);
  }, [debouncedValidateField]);

  /**
   * Update permissions field
   */
  const updatePermissions = useCallback((field: keyof UIConfiguration['permissions'], value: boolean) => {
    setConfig(prev => {
      if (!prev) return null;
      return {
        ...prev,
        permissions: { ...prev.permissions, [field]: value }
      };
    });
  }, []);

  /**
   * Update advanced configuration field
   * Uses debounced validation for number fields (Requirement: 1.2, 2.2)
   */
  const updateAdvanced = useCallback((field: keyof UIConfiguration['advanced'], value: any) => {
    setConfig(prev => {
      if (!prev) return null;
      
      const newConfig = {
        ...prev,
        advanced: { ...prev.advanced, [field]: value }
      };

      return newConfig;
    });

    // Debounced validation for number fields
    if (field === 'maxLoopCount' || field === 'contextWindowSize') {
      debouncedValidateField(field, value);
    }
  }, [debouncedValidateField]);

  /**
   * Save configuration to extension
   */
  const saveConfiguration = useCallback(() => {
    if (!config) return;

    // Validate all fields before saving
    if (!validateAll()) {
      return;
    }

    setIsSaving(true);
    const message: ConfigMessage = {
      type: 'save_configuration',
      config
    };
    postMessage(message);
  }, [config, validateAll, postMessage]);

  /**
   * Test API connection
   */
  const testConnection = useCallback(() => {
    if (!config) return;

    // Validate API config before testing
    const apiErrors: ValidationErrors = {};
    apiErrors.baseUrl = validateField('baseUrl', config.api.baseUrl);
    apiErrors.model = validateField('model', config.api.model);
    apiErrors.apiKey = validateField('apiKey', config.api.apiKey);
    apiErrors.temperature = validateField('temperature', config.api.temperature);
    apiErrors.maxTokens = validateField('maxTokens', config.api.maxTokens);

    if (Object.values(apiErrors).some(error => error !== undefined)) {
      setValidationErrors(prevErrors => ({ ...prevErrors, ...apiErrors }));
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    const message: ConfigMessage = {
      type: 'test_connection',
      apiConfig: config.api
    };
    postMessage(message);
  }, [config, validateField, postMessage]);



  /**
   * Handle messages from extension
   */
  const handleMessage = useCallback((message: ConfigResponse) => {
    switch (message.type) {
      case 'configuration_loaded':
        setConfig(message.config);
        setIsLoading(false);
        setIsFirstTime(message.isFirstTime || false);
        break;

      case 'configuration_saved':
        setIsSaving(false);
        if (!message.success && message.error) {
          console.error('Failed to save configuration:', message.error);
        }
        break;

      case 'connection_test_result':
        setIsTesting(false);
        setTestResult({
          success: message.success,
          error: message.error,
          responseTime: message.responseTime
        });
        break;



      case 'validation_error':
        setValidationErrors(message.errors);
        setIsSaving(false);
        break;
    }
  }, [postMessage]);

  // Listen for messages from extension
  useMessageListener<ConfigResponse>(handleMessage, [handleMessage]);

  /**
   * Load configuration on mount
   */
  useEffect(() => {
    const message: ConfigMessage = { type: 'get_configuration' };
    postMessage(message);
  }, [postMessage]);

  return {
    // State
    config,
    validationErrors,
    isLoading,
    isSaving,
    isTesting,
    testResult,
    isFirstTime,

    // Actions
    updateConfig,
    updateApiConfig,
    updatePermissions,
    updateAdvanced,
    saveConfiguration,
    testConnection,
    validateAll,
  };
}
