# Standard Termux project context. Commands are defined, never auto-run.
project_env PROJECT_NAME 'arcade-hub'
project_env PROJECT_DESCRIPTION 'AI Studio arcade application with browser games and Solana-aware UI components.'
project_env PROJECT_PORTS '3000'
project_env PROJECT_START 'npm run dev'
project_env PROJECT_STOP 'Not documented'
project_env PROJECT_STATUS 'git status'
project_env PROJECT_COMMANDS $'    start    npm run dev\n    install  npm install'

project_alias start 'cd "$PROJECT_ROOT" && npm run dev'
project_alias install 'cd "$PROJECT_ROOT" && npm install'
