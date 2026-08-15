# Standard Termux project context. Commands are defined, never auto-run.
project_env PROJECT_NAME 'arcade-hub'
project_env PROJECT_DESCRIPTION $'Arcade application with browser games and Supabase-backed player services.\nWebsite: https://metatim89-a11y.github.io/arcade-hub/\nSupabase project: arcade-hub (ybgxtqzoevcmondbddsc)\nSupabase dashboard: https://supabase.com/dashboard/project/ybgxtqzoevcmondbddsc'
project_env PROJECT_PORTS '3000'
project_env PROJECT_START 'start → bash "$PROJECT_ROOT/custom.sh" start'
project_env PROJECT_STOP 'Press Ctrl+C in the server terminal'
project_env PROJECT_STATUS 'repo-status → bash "$PROJECT_ROOT/custom.sh" repo-status'
project_env PROJECT_COMMANDS $'arcade-help → bash "$PROJECT_ROOT/custom.sh" help\nstart → bash "$PROJECT_ROOT/custom.sh" start\nbuild → bash "$PROJECT_ROOT/custom.sh" build\npreview → bash "$PROJECT_ROOT/custom.sh" preview\ninstall → bash "$PROJECT_ROOT/custom.sh" install\nrepo-check → bash "$PROJECT_ROOT/custom.sh" repo-check\nrepo-status → bash "$PROJECT_ROOT/custom.sh" repo-status\nrepo-diff → bash "$PROJECT_ROOT/custom.sh" repo-diff'

# Keep alias definitions in the project-specific alias file.
# shellcheck source=/dev/null
source "$PROJECT_ROOT/.ali"
