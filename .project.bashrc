# .project.bashrc - Arcade Hub
# Version: 1.0.0
# Project: Arcade Hub

# Load aliases
if [ -f "./.project.bashaliases" ]; then
    source "./.project.bashaliases"
fi

# Show MOTD
if [ -f "./motd" ]; then
    cat ./motd
fi

# Project environment variables
export PROJECT_NAME="Arcade Hub"
export APP_VERSION="0.0.6"
