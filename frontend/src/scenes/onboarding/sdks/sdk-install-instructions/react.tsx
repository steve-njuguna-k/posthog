import { useValues } from 'kea'
import { CodeSnippet, Language } from 'lib/components/CodeSnippet'
import { apiHostOrigin } from 'lib/utils/apiHost'
import { teamLogic } from 'scenes/teamLogic'

import { JSInstallSnippet } from './js-web'

function ReactEnvVarsSnippet(): JSX.Element {
    const { currentTeam } = useValues(teamLogic)

    return (
        <CodeSnippet language={Language.Bash}>
            {[
                `REACT_APP_PUBLIC_POSTHOG_KEY=${currentTeam?.api_token}`,
                `REACT_APP_PUBLIC_POSTHOG_HOST=${apiHostOrigin()}`,
            ].join('\n')}
        </CodeSnippet>
    )
}

function ReactSetupSnippet(): JSX.Element {
    return (
        <CodeSnippet language={Language.JavaScript}>
            {`// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import { PostHogProvider} from 'posthog-js/react'

const options = {
  api_host: process.env.REACT_APP_PUBLIC_POSTHOG_HOST,
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <PostHogProvider 
      apiKey={process.env.REACT_APP_PUBLIC_POSTHOG_KEY}
      options={options}
    >
      <App />
    </PostHogProvider>
  </React.StrictMode>
);`}
        </CodeSnippet>
    )
}

export function SDKInstallReactInstructions(): JSX.Element {
    return (
        <>
            <h3>Install the package</h3>
            <JSInstallSnippet />
            <h3>Add environment variables</h3>
            <ReactEnvVarsSnippet />
            <h3>Initialize</h3>
            <p>Integrate PostHog at the root of your app.</p>
            <ReactSetupSnippet />
        </>
    )
}
