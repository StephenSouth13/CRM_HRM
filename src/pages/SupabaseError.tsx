import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { getSupabaseConfigStatus } from "@/integrations/supabase/utils";

const SupabaseErrorPage = () => {
  const navigate = useNavigate();
  const configStatus = getSupabaseConfigStatus();

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-red-200 dark:border-red-800">
        <CardHeader className="bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-t-lg">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-6 w-6" />
            <CardTitle className="text-2xl">Supabase Connection Error</CardTitle>
          </div>
          <CardDescription className="text-red-100">
            Unable to connect to the database
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8 space-y-6">
          {/* Main Error Message */}
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              The application is unable to connect to Supabase. This could be due to network issues, 
              invalid credentials, or a service outage.
            </AlertDescription>
          </Alert>

          {/* Configuration Status */}
          <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Configuration Status
            </h3>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Configured:</span>
                <span className={configStatus.configured ? "text-green-600" : "text-red-600"}>
                  {configStatus.configured ? "✓ Yes" : "✗ No"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Supabase URL:</span>
                <span className={configStatus.url ? "text-gray-900 dark:text-gray-100" : "text-red-600"}>
                  {configStatus.url || "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">API Key:</span>
                <span className={configStatus.keyPresent ? "text-green-600" : "text-red-600"}>
                  {configStatus.keyPresent ? "✓ Present" : "✗ Missing"}
                </span>
              </div>
            </div>
          </div>

          {/* Troubleshooting Steps */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Troubleshooting Steps:
            </h3>
            <ol className="space-y-2 text-sm list-decimal list-inside text-gray-700 dark:text-gray-300">
              <li>
                <strong>Check Your Internet:</strong> Ensure you have a stable internet connection.
              </li>
              <li>
                <strong>Verify Environment Variables:</strong> Make sure <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">VITE_SUPABASE_URL</code> and 
                <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code> are set.
              </li>
              <li>
                <strong>Check Supabase Status:</strong> Visit{" "}
                <a
                  href="https://status.supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  status.supabase.com
                </a>{" "}
                to check for service outages.
              </li>
              <li>
                <strong>Verify Credentials:</strong> Ensure your Supabase project is active at{" "}
                <a
                  href="https://app.supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  app.supabase.com
                </a>
              </li>
              <li>
                <strong>Clear Cache:</strong> Try clearing your browser cache and cookies.
              </li>
              <li>
                <strong>Wait and Retry:</strong> If Supabase is experiencing issues, wait a few moments 
                and try again.
              </li>
            </ol>
          </div>

          {/* For Deployment Users */}
          <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
              ℹ️ For Deployment
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              If you're seeing this on a deployed application (not localhost), make sure the 
              environment variables are properly set in your deployment platform's settings:
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4">
              <li>• <strong>VITE_SUPABASE_URL</strong>: Your Supabase project URL</li>
              <li>• <strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong>: Your Supabase anon/public key</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={handleRetry}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="flex-1"
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Footer Info */}
      <div className="absolute bottom-4 left-4 right-4 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>If this issue persists, please contact support or check the console for more details.</p>
      </div>
    </div>
  );
};

export default SupabaseErrorPage;
