import React, { useState } from 'react';
import { Copy, Check, Code, Terminal, FileCode } from 'lucide-react';

type Language = 'curl' | 'python' | 'javascript' | 'typescript';

interface ApiSnippetGeneratorProps {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, any>;
  headers?: Record<string, string>;
  description?: string;
  apiKeyName?: string;
}

const LANGUAGE_LABELS: Record<Language, { label: string; icon: React.ReactNode }> = {
  curl: { label: 'cURL', icon: <Terminal className="w-4 h-4" /> },
  python: { label: 'Python', icon: <FileCode className="w-4 h-4" /> },
  javascript: { label: 'JavaScript', icon: <Code className="w-4 h-4" /> },
  typescript: { label: 'TypeScript', icon: <Code className="w-4 h-4" /> },
};

export const ApiSnippetGenerator: React.FC<ApiSnippetGeneratorProps> = ({
  endpoint,
  method,
  body,
  headers = {},
  description,
  apiKeyName = 'YOUR_API_KEY',
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('curl');
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin + '/api/v1';
  const fullUrl = `${baseUrl}${endpoint}`;

  const generateCurlSnippet = (): string => {
    let snippet = `curl -X ${method} '${fullUrl}'`;

    // Add headers
    snippet += ` \\\n  -H 'Content-Type: application/json'`;
    snippet += ` \\\n  -H 'X-API-Key: ${apiKeyName}'`;

    Object.entries(headers).forEach(([key, value]) => {
      snippet += ` \\\n  -H '${key}: ${value}'`;
    });

    // Add body
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      snippet += ` \\\n  -d '${JSON.stringify(body, null, 2)}'`;
    }

    return snippet;
  };

  const generatePythonSnippet = (): string => {
    let snippet = `import requests

url = "${fullUrl}"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "${apiKeyName}",`;

    Object.entries(headers).forEach(([key, value]) => {
      snippet += `\n    "${key}": "${value}",`;
    });

    snippet += `
}
`;

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      snippet += `
payload = ${JSON.stringify(body, null, 4).replace(/"/g, '"')}

response = requests.${method.toLowerCase()}(url, headers=headers, json=payload)`;
    } else {
      snippet += `
response = requests.${method.toLowerCase()}(url, headers=headers)`;
    }

    snippet += `

# Check response
if response.ok:
    data = response.json()
    print(data)
else:
    print(f"Error: {response.status_code}")
    print(response.text)`;

    return snippet;
  };

  const generateJavaScriptSnippet = (): string => {
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKeyName,
      ...headers,
    };

    let snippet = `const url = '${fullUrl}';

const options = {
  method: '${method}',
  headers: ${JSON.stringify(fetchHeaders, null, 4)},`;

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      snippet += `
  body: JSON.stringify(${JSON.stringify(body, null, 4)}),`;
    }

    snippet += `
};

fetch(url, options)
  .then(response => {
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Success:', data);
  })
  .catch(error => {
    console.error('Error:', error);
  });`;

    return snippet;
  };

  const generateTypeScriptSnippet = (): string => {
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKeyName,
      ...headers,
    };

    let snippet = `const url: string = '${fullUrl}';

interface ApiResponse {
  // Define your response type here
  [key: string]: any;
}

const options: RequestInit = {
  method: '${method}',
  headers: ${JSON.stringify(fetchHeaders, null, 4)},`;

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      snippet += `
  body: JSON.stringify(${JSON.stringify(body, null, 4)}),`;
    }

    snippet += `
};

async function makeRequest(): Promise<ApiResponse> {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  return response.json();
}

// Usage
makeRequest()
  .then((data: ApiResponse) => {
    console.log('Success:', data);
  })
  .catch((error: Error) => {
    console.error('Error:', error);
  });`;

    return snippet;
  };

  const getSnippet = (): string => {
    switch (selectedLanguage) {
      case 'curl':
        return generateCurlSnippet();
      case 'python':
        return generatePythonSnippet();
      case 'javascript':
        return generateJavaScriptSnippet();
      case 'typescript':
        return generateTypeScriptSnippet();
      default:
        return generateCurlSnippet();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getSnippet());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded ${
              method === 'GET'
                ? 'bg-green-600 text-white'
                : method === 'POST'
                ? 'bg-blue-600 text-white'
                : method === 'PUT' || method === 'PATCH'
                ? 'bg-yellow-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {method}
          </span>
          <code className="text-sm text-gray-300">{endpoint}</code>
        </div>
        {description && (
          <span className="text-xs text-gray-400">{description}</span>
        )}
      </div>

      {/* Language Tabs */}
      <div className="px-4 py-2 bg-gray-800 flex items-center space-x-1 border-b border-gray-700">
        {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
          <button
            key={lang}
            onClick={() => setSelectedLanguage(lang)}
            className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              selectedLanguage === lang
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            {LANGUAGE_LABELS[lang].icon}
            <span>{LANGUAGE_LABELS[lang].label}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={copyToClipboard}
          className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium rounded-md text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Block */}
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
          {getSnippet()}
        </pre>
      </div>
    </div>
  );
};

export default ApiSnippetGenerator;
