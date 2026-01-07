import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, Loader2, AlertCircle, Play, Pause } from 'lucide-react';
import api from '../../services/api';

interface WorkflowStep {
  id: string;
  step_name: string;
  step_order: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  attempt_count: number;
  max_attempts: number;
  error_message: string | null;
}

interface WorkflowStatus {
  id: string;
  job_run_id: string;
  workflow_name: string;
  workflow_version: string;
  current_state: string;
  progress_percentage: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  failed_step: string | null;
  steps: WorkflowStep[];
}

interface WorkflowProgressProps {
  jobRunId: string;
  onComplete?: (status: WorkflowStatus) => void;
  onError?: (error: string) => void;
  pollInterval?: number;
  showSteps?: boolean;
}

const STEP_DISPLAY_NAMES: Record<string, string> = {
  initialize: 'Initialize',
  fetch_data: 'Fetch Data',
  pre_validation: 'Pre-Validation',
  transform: 'Transform',
  post_validation: 'Post-Validation',
  generate_artifacts: 'Generate Artifacts',
  deliver: 'Deliver',
};

const STATE_DISPLAY_NAMES: Record<string, string> = {
  pending: 'Pending',
  initializing: 'Initializing',
  fetching_data: 'Fetching Data',
  pre_validation: 'Running Validations',
  transforming: 'Transforming',
  post_validation: 'Validating Output',
  generating_artifacts: 'Generating Artifacts',
  delivering: 'Delivering',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  waiting_retry: 'Waiting for Retry',
  paused: 'Paused',
};

const getStepIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'running':
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'pending':
      return <Clock className="w-5 h-5 text-gray-400" />;
    case 'skipped':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    default:
      return <Clock className="w-5 h-5 text-gray-400" />;
  }
};

const getStateColor = (state: string): string => {
  switch (state) {
    case 'completed':
      return 'bg-green-500';
    case 'failed':
    case 'cancelled':
      return 'bg-red-500';
    case 'pending':
      return 'bg-gray-400';
    default:
      return 'bg-blue-500';
  }
};

const formatDuration = (ms: number | null): string => {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  jobRunId,
  onComplete,
  onError,
  pollInterval = 2000,
  showSteps = true,
}) => {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let mounted = true;

    const fetchStatus = async () => {
      try {
        const response = await api.get(`/workflow/runs/${jobRunId}/workflow`);
        if (!mounted) return;

        setStatus(response.data);
        setLoading(false);
        setError(null);

        // Check if complete
        const isComplete = ['completed', 'failed', 'cancelled'].includes(
          response.data.current_state
        );

        if (isComplete) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          if (response.data.current_state === 'completed') {
            onComplete?.(response.data);
          } else if (response.data.current_state === 'failed') {
            onError?.(response.data.error_message || 'Workflow failed');
          }
        }
      } catch (err: any) {
        if (!mounted) return;
        const errorMsg = err.response?.data?.detail || 'Failed to fetch workflow status';
        setError(errorMsg);
        setLoading(false);
      }
    };

    // Initial fetch
    fetchStatus();

    // Start polling
    intervalId = setInterval(fetchStatus, pollInterval);

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [jobRunId, pollInterval, onComplete, onError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading workflow status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <XCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const isRunning = !['completed', 'failed', 'cancelled', 'pending'].includes(
    status.current_state
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isRunning ? (
              <Play className="w-5 h-5 text-blue-500 mr-2" />
            ) : status.current_state === 'completed' ? (
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            ) : status.current_state === 'failed' ? (
              <XCircle className="w-5 h-5 text-red-500 mr-2" />
            ) : (
              <Pause className="w-5 h-5 text-gray-500 mr-2" />
            )}
            <span className="font-medium text-gray-900">
              {STATE_DISPLAY_NAMES[status.current_state] || status.current_state}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            {status.duration_ms !== null && (
              <span>Duration: {formatDuration(status.duration_ms)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm font-medium text-gray-700">
            {status.progress_percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${getStateColor(
              status.current_state
            )}`}
            style={{ width: `${status.progress_percentage}%` }}
          />
        </div>
      </div>

      {/* Error Message */}
      {status.error_message && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-200">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{status.error_message}</p>
              {status.failed_step && (
                <p className="text-xs text-red-600 mt-1">
                  Failed at: {STEP_DISPLAY_NAMES[status.failed_step] || status.failed_step}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      {showSteps && status.steps.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Steps</h4>
          <div className="space-y-2">
            {status.steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center justify-between p-2 rounded ${
                  step.status === 'running'
                    ? 'bg-blue-50'
                    : step.status === 'failed'
                    ? 'bg-red-50'
                    : step.status === 'completed'
                    ? 'bg-green-50'
                    : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  {getStepIcon(step.status)}
                  <span className="ml-2 text-sm text-gray-700">
                    {STEP_DISPLAY_NAMES[step.step_name] || step.step_name}
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-xs text-gray-500">
                  {step.attempt_count > 1 && (
                    <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                      Attempt {step.attempt_count}/{step.max_attempts}
                    </span>
                  )}
                  {step.duration_ms !== null && (
                    <span>{formatDuration(step.duration_ms)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowProgress;
