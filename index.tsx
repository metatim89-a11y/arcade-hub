import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

// Define a type for Agent Status and Logs
interface AgentInfo {
  name: string; // e.g., "audit-agent.sh"
  displayName: string; // e.g., "Audit Agent"
  group: string; // e.g., "overseer", "workflow"
  status: 'running' | 'stopped' | 'error' | 'idle' | 'completed' | 'unknown';
  logs: string[];
  executablePath: string; // Path to the script
  commands?: string[]; // For agents with multiple commands like workflow, time
  pidFilePath?: string; // For daemons like flip-agent
  logFilePath?: string; // For specific log files
}

// Define the desired grouping order
const AGENT_GROUP_ORDER: string[] = [
  'overseer',
  'workflow',
  'time',
  'maintenance',
  'sync',
  'monitoring',
  'utility',
  'communication',
  'development',
  'trading',
  'other',
];

// Helper to map agent script names to display names and group keys
const getAgentDetails = (agentName: string): { displayName: string; group: string } => {
  const mapping: Record<string, { displayName: string; group: string }> = {
    'overseer-agent.sh': { displayName: 'Overseer', group: 'overseer' },
    'workflow-agent.sh': { displayName: 'Workflow', group: 'workflow' },
    'time-agent.sh': { displayName: 'Time Sync', group: 'time' },
    'audit-agent.sh': { displayName: 'Audit', group: 'maintenance' },
    'backup-agent.sh': { displayName: 'Backup', group: 'maintenance' },
    'clean-agent.sh': { displayName: 'Cleanup', group: 'maintenance' },
    'flip-agent.sh': { displayName: 'Flip Trading Bot', group: 'trading' },
    'github-agent.sh': { displayName: 'GitHub Sync', group: 'sync' },
    'log-agent.sh': { displayName: 'Log Collector', group: 'monitoring' },
    'project-agent.sh': { displayName: 'Project Scaffolding', group: 'utility' },
    'push-agent.sh': { displayName: 'Global Push', group: 'sync' },
    'rename_pics.py': { displayName: 'Rename Pics', group: 'utility' },
    'rename-agent.sh': { displayName: 'Rename Agent', group: 'utility' },
    'sentinel-agent.sh': { displayName: 'Sentinel', group: 'monitoring' },
    'whois-agent.sh': { displayName: 'Whois Lookup', group: 'utility' },
    'bash-agent.sh': { displayName: 'Bash Helper', group: 'utility' },
    'broker-agent.sh': { displayName: 'Broker', group: 'communication' },
    'bug-finder-agent.sh': { displayName: 'Bug Finder', group: 'development' },
    'vibe-agent.sh': { displayName: 'Vibe Agent', group: 'development'}
  };
  return mapping[agentName] || { displayName: agentName, group: 'other' };
};

const CommandCenter: React.FC = () => {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentCommandInputs, setAgentCommandInputs] = useState<{ [agentName: string]: string }>({});

  // --- Backend Interaction Functions ---
  // These functions use run_shell_command and read_file to interact with agents.

  const runShellCommand = async (command: string, options?: { dir_path?: string; description?: string; is_background?: boolean }) => {
    try {
      // NOTE: In a real frontend, this would call a backend API that then uses run_shell_command.
      // For simulation purposes here, we'll assume this returns output directly.
      // In the actual CLI environment, this would be a tool call.
      console.log(`Executing: ${command}`, options);
      // Simulate API call or tool execution
      // await fetch('/api/run-shell', { method: 'POST', body: JSON.stringify({ command, ...options }) });
      // For now, just log it.
      return { output: `Simulated execution of: ${command}` };
    } catch (err) {
      console.error("Error running shell command:", err);
      throw err; // Re-throw to be caught by caller
    }
  };

  const readFileContent = async (filePath: string) => {
    try {
      console.log(`Reading file: ${filePath}`);
      // !!! Replace with actual API call to read file !!!
      // Example: const response = await fetch(`/api/read-file?path=${encodeURIComponent(filePath)}`);
      // const data = await response.json();
      // For now, return mock data or an empty string if file not found/readable
      if (filePath.endsWith('time_offset.sec')) return "0"; // Mock offset
      if (filePath.endsWith('sentinel.log')) return "Sentinel log entry: Protocol OK."; // Mock sentinel log
      if (filePath.endsWith('flip-agent.log')) return "Flip Agent: Last trade successful."; // Mock flip log
      return ""; // Default empty content
    } catch (err) {
      console.error(`Error reading file ${filePath}:`, err);
      return `Error reading ${filePath}`;
    }
  };

  const getAgentStatus = async (agentName: string, agentInfo: AgentInfo): Promise<AgentInfo['status']> => {
    try {
      if (agentInfo.pidFilePath) {
        const pidContent = await readFileContent(agentInfo.pidFilePath);
        if (pidContent && pidContent.trim()) {
          const pid = parseInt(pidContent.trim(), 10);
          if (!isNaN(pid)) {
            // Check if process with PID is running
            const psOutput = await runShellCommand(`ps -p ${pid}`);
            if (psOutput.output && psOutput.output.includes(agentName)) {
              return 'running';
            } else {
              return 'stopped'; // PID file exists but process not found
            }
          }
        }
      } else {
        // For non-daemon scripts, status might be 'idle' if not recently run,
        // or 'running' if a process is active. This is harder to track without explicit process management.
        // For now, assume idle unless a process is detected.
        const psOutput = await runShellCommand(`ps aux | grep ${agentName} | grep -v grep`);
        if (psOutput.output && psOutput.output.trim() !== '') {
          // Basic check: if grep finds the process, assume running
          return 'running';
        } else {
          return 'idle';
        }
      }
    } catch (err) {
      console.error(`Error checking status for ${agentName}:`, err);
      return 'unknown';
    }
    return 'stopped'; // Default if no PID or process found
  };

  const fetchAgentData = async () => {
    console.log("Fetching agent data...");
    setLoading(true);
    setError(null);
    try {
      // Define agent configurations based on the directory listing and analysis
      const agentConfigs: AgentInfo[] = [
        { name: 'overseer-agent.sh', displayName: 'Overseer', group: 'overseer', status: 'idle', logs: [], executablePath: '/data/data/com.termux/files/home/agents/overseer-agent.sh', commands: ['check'], logFilePath: '/data/data/com.termux/files/home/.logs/sentinel.log' },
        { name: 'workflow-agent.sh', displayName: 'Workflow', group: 'workflow', status: 'idle', logs: [], executablePath: '/data/data/com.termux/files/home/agents/workflow-agent.sh', commands: ['sync-all', 'dev-start'], logFilePath: null }, // Assuming stdout/stderr capture for logs
        { name: 'time-agent.sh', displayName: 'Time Sync', group: 'time', status: 'idle', logs: [], executablePath: '/data/data/com.termux/files/home/agents/time-agent.sh', commands: ['get', 'set', 'stamp'], logFilePath: '/data/data/com.termux/files/home/.logs/time_offset.sec' },
        { name: 'flip-agent.sh', displayName: 'Flip Trading Bot', group: 'trading', status: 'stopped', logs: [], executablePath: '/data/data/com.termux/files/home/agents/flip-agent.sh', pidFilePath: '/data/data/com.termux/files/home/.logs/flip-agent.pid', logFilePath: '/data/data/com.termux/files/home/.logs/flip-agent.log' },
        { name: 'audit-agent.sh', displayName: 'Audit', group: 'maintenance', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/audit-agent.sh', logs: [] },
        { name: 'backup-agent.sh', displayName: 'Backup', group: 'maintenance', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/backup-agent.sh', logs: [] },
        { name: 'bash-agent.sh', displayName: 'Bash Helper', group: 'utility', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/bash-agent.sh', logs: [] },
        { name: 'broker-agent.sh', displayName: 'Broker', group: 'communication', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/broker-agent.sh', logs: [] },
        { name: 'bug-finder-agent.sh', displayName: 'Bug Finder', group: 'development', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/bug-finder-agent.sh', logs: [] },
        { name: 'clean-agent.sh', displayName: 'Cleanup', group: 'maintenance', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/clean-agent.sh', logs: [] },
        { name: 'github-agent.sh', displayName: 'GitHub Sync', group: 'sync', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/github-agent.sh', logs: [] },
        { name: 'log-agent.sh', displayName: 'Log Collector', group: 'monitoring', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/log-agent.sh', logs: [] },
        { name: 'project-agent.sh', displayName: 'Project Scaffolding', group: 'utility', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/project-agent.sh', logs: [] },
        { name: 'push-agent.sh', displayName: 'Global Push', group: 'sync', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/push-agent.sh', logs: [] },
        { name: 'rename_pics.py', displayName: 'Rename Pics', group: 'utility', status: 'stopped', executablePath: 'python /data/data/com.termux/files/home/agents/rename_pics.py', logs: [] }, // Note: python executable
        { name: 'rename-agent.sh', displayName: 'Rename Agent', group: 'utility', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/rename-agent.sh', logs: [] },
        { name: 'sentinel-agent.sh', displayName: 'Sentinel', group: 'monitoring', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/sentinel-agent.sh', logs: [] },
        { name: 'vibe-agent.sh', displayName: 'Vibe Agent', group: 'development', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/vibe-agent.sh', logs: [] },
        { name: 'whois-agent.sh', displayName: 'Whois Lookup', group: 'utility', status: 'stopped', executablePath: '/data/data/com.termux/files/home/agents/whois-agent.sh', logs: [] },
      ];

      // In a real app, fetch status for each agent from backend
      // For simulation, we'll update status based on mock data or initial state
      const updatedAgents = await Promise.all(agentConfigs.map(async (agent) => {
        let currentStatus = agent.status;
        if (agent.executablePath) {
          // For scripts, a basic check if process is running might be needed
          // This is a placeholder, real check would involve backend call to ps/pids
          if (agent.name === 'flip-agent.sh' && agent.pidFilePath) {
              try {
                const pidContent = await readFileContent(agent.pidFilePath);
                if (pidContent && pidContent.trim()) {
                  const pid = parseInt(pidContent.trim(), 10);
                  if (!isNaN(pid)) {
                    // Simulate checking process, in reality this would be a backend call
                    const psOutput = await runShellCommand(`ps -p ${pid}`);
                    if (psOutput.output && psOutput.output.includes(agent.name)) {
                      currentStatus = 'running';
                    } else {
                      currentStatus = 'stopped';
                    }
                  } else {
                    currentStatus = 'error'; // PID file invalid
                  }
                } else {
                  currentStatus = 'stopped'; // PID file missing or empty
                }
              } catch (e) {
                console.warn(`Could not check PID file for ${agent.name}: ${e}`);
                currentStatus = 'unknown';
              }
          } else if (agent.name === 'overseer-agent.sh' || agent.name === 'workflow-agent.sh' || agent.name === 'time-agent.sh') {
             // For task runners, assume idle unless we have a way to track active execution
             currentStatus = 'idle';
          }
        }
        // Fetch logs if logFilePath is defined
        let logs: string[] = [];
        if (agent.logFilePath) {
            const logContent = await readFileContent(agent.logFilePath);
            logs = logContent ? logContent.split('\n').slice(-10) : ["No logs yet."]; // Show last 10 lines
        } else if (agent.name === 'overseer-agent.sh') {
            logs = ["Overseer logs would appear here."]; // Mock for overseer
        }

        return { ...agent, status: currentStatus, logs: logs };
      }));

      setAgents(updatedAgents);

    } catch (err) {
      console.error("Error fetching agent data:", err);
      setError("Failed to load agent status. Please ensure backend services are running and accessible.");
    } finally {
      setLoading(false);
    }
  };

  // Action: Start, Stop, Restart agent
  const handleAgentAction = async (agentName: string, action: 'start' | 'stop' | 'restart') => {
    const agent = agents.find(a => a.name === agentName);
    if (!agent) return;

    console.log(`Attempting to ${action} agent: ${agentName}`);
    setError(null); // Clear previous errors

    try {
      let command = '';
      let options: any = {};

      if (action === 'start') {
        // Determine start command based on agent type and available commands
        if (agent.name === 'overseer-agent.sh') {
          command = `${agent.executablePath} check`;
        } else if (agent.name === 'workflow-agent.sh') {
          // Assuming a selection mechanism would be needed here if agent has multiple commands
          // For now, let's default to 'sync-all' or prompt user if 'dev-start' is intended
          command = `${agent.executablePath} sync-all`; // Default or based on UI choice
        } else if (agent.name === 'time-agent.sh') {
          command = `${agent.executablePath} get`; // Default command for time agent
        } else if (agent.name === 'flip-agent.sh') {
          command = `${agent.executablePath} --start`; // Specific start command
        } else if (agent.executablePath.endsWith('.py')) {
            command = `python ${agent.executablePath}`;
        }
         else {
          command = agent.executablePath; // Direct execution for others
        }
        options = { description: `Starting ${agent.displayName}` };
        // For daemons, run in background
        if (agent.pidFilePath) { // Heuristic for daemons
            options.is_background = true;
        }

      } else if (action === 'stop') {
        if (agent.pidFilePath) {
          const pidContent = await readFileContent(agent.pidFilePath);
          if (pidContent && pidContent.trim()) {
            const pid = parseInt(pidContent.trim(), 10);
            if (!isNaN(pid)) {
              command = `kill ${pid}`;
              options = { description: `Stopping ${agent.displayName} (PID: ${pid})` };
            } else {
              throw new Error("Invalid PID in file.");
            }
          } else {
            throw new Error("PID file is empty or missing.");
          }
        } else {
          // For non-daemon scripts, stop might mean killing the process if it's running
          // This is trickier without knowing the exact process name or command structure
          // Using pkill as a general approach, but might need refinement
          command = `pkill -f ${agent.name}`;
          options = { description: `Attempting to stop ${agent.displayName} process` };
        }
      } else if (action === 'restart') {
        // Perform stop first, then start
        await handleAgentAction(agentName, 'stop');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay
        command = `/data/data/com.termux/files/home/agents/${agent.name}`; // Re-execute start command
        if (agent.name === 'workflow-agent.sh') command += ' sync-all'; // Example default command
        if (agent.name === 'time-agent.sh') command += ' get'; // Example default command
        if (agent.name === 'overseer-agent.sh') command += ' check'; // Example default command
        options = { description: `Restarting ${agent.displayName}` };
        if (agent.pidFilePath) options.is_background = true;
      }

      if (command) {
        await runShellCommand(command, options);
      }

      // Refresh status after action
      fetchAgentData();
    } catch (err: any) {
      console.error(`Error ${action} agent ${agentName}:`, err);
      setError(`Failed to ${action} ${agentName}. ${err.message || ''}`);
    }
  };

  // Action: Execute a command for an agent
  const executeAgentCommand = async (agentName: string, command: string) => {
    const agent = agents.find(a => a.name === agentName);
    if (!agent || !command.trim()) return;

    console.log(`Executing command "${command}" for agent: ${agentName}`);
    setError(null);
    try {
      // For agents that take commands, execute them.
      // This might require dynamically constructing the command.
      // Example: if agent is workflow-agent.sh, and command is 'sync-all'
      // commandToRun = `${agent.executablePath} ${command}`;
      const commandToRun = `${agent.executablePath.endsWith('.py') ? 'python' : ''} ${agent.executablePath} ${command}`;
      const result = await runShellCommand(commandToRun, { description: `Executing command for ${agent.displayName}` });
      alert(`Command "${command}" executed. Output:
${result.output}`); // Placeholder
      fetchAgentData(); // Refresh status/logs
    } catch (err: any) {
      console.error(`Error executing command for agent ${agentName}:`, err);
      setError(`Failed to execute command for ${agentName}. ${err.message || ''}`);
    }
  };

  // Effect hook to fetch data on component mount
  useEffect(() => {
    fetchAgentData();
    // Optionally, set up interval for polling status if real-time isn't available
    // const intervalId = setInterval(fetchAgentData, 5000); // Fetch every 5 seconds
    // return () => clearInterval(intervalId); // Cleanup on unmount
  }, []);

  // --- UI Rendering ---
  // Group agents based on AGENT_GROUP_ORDER
  const groupedAgents = agents.reduce((acc, agent) => {
    const agentInfo = getAgentDetails(agent.name);
    const groupKey = agentInfo.group;
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push({ ...agent, displayName: agentInfo.displayName, group: groupKey }); // Ensure groupKey is added
    return acc;
  }, {} as Record<string, AgentInfo[]>);

  const handleCommandInputChange = (agentName: string, value: string) => {
    setAgentCommandInputs(prev => ({ ...prev, [agentName]: value }));
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen font-sans">
      <h1 className="text-4xl font-bold mb-8 text-cyan-400 text-center shadow-text-cyan">Agent Command Center</h1>

      {loading && (
        <div className="flex justify-center items-center h-48">
          <p className="text-lg text-gray-400 animate-pulse">Loading agents...</p>
        </div>
      )}
      {error && (
        <div className="text-center p-6 bg-red-800/30 border border-red-600 rounded-xl shadow-lg">
          <p className="text-red-400 font-semibold text-lg">Error:</p>
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {!loading && !error && Object.keys(groupedAgents).length === 0 && (
        <div className="text-center p-10 bg-gray-800/50 rounded-xl border border-gray-700 shadow-inner">
          <p className="text-xl text-gray-400">No agents found or loaded.</p>
          <p className="text-sm text-gray-500 mt-2">Ensure the backend service managing agents is running and accessible.</p>
        </div>
      )}

      {!loading && !error && Object.keys(groupedAgents).length > 0 && (
        <div className="space-y-10">
          {AGENT_GROUP_ORDER.map((groupKey) => {
            if (!groupedAgents[groupKey] || groupedAgents[groupKey].length === 0) return null;

            return (
              <section key={groupKey} className="bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
                <h2 className="text-3xl font-bold mb-6 capitalize text-amber-400 border-b-2 border-gray-700 pb-4 shadow-text-amber">
                  {groupKey.replace('-', ' ')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {groupedAgents[groupKey].map((agent) => {
                    const agentCommand = agentCommandInputs[agent.name] || '';
                    const isTaskRunner = !agent.pidFilePath && !agent.commands?.includes('dev-start'); // Heuristic for task runners
                    const isDaemon = agent.pidFilePath;

                    return (
                      <div key={agent.name} className="bg-gray-700/50 p-6 rounded-xl shadow-inner border border-gray-600 hover:shadow-lg transition-shadow duration-300 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-2xl font-semibold text-cyan-300">
                              {agent.displayName}
                            </h3>
                            <span className={`text-lg font-medium px-3 py-1 rounded-full ${
                              agent.status === 'running' ? 'bg-green-500/20 text-green-300 animate-pulse' :
                              agent.status === 'stopped' ? 'bg-red-500/20 text-red-300' :
                              agent.status === 'error' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-gray-500/20 text-gray-300'
                            }`}>
                              {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                            </span>
                          </div>

                          <div className="mb-4 text-sm text-gray-300 h-32 overflow-y-auto border border-gray-600 rounded-lg p-3 bg-gray-800/50 shadow-sm">
                            <h4 className="text-gray-400 font-semibold mb-1 text-xs">Logs:</h4>
                            {agent.logs.length > 0 ? (
                              agent.logs.map((log, i) => <p key={i} className="text-gray-300 text-xs leading-relaxed mb-0.5">{log}</p>)
                            ) : (
                              <p className="text-gray-500 italic">No logs yet.</p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-4">
                          {/* Agent Control Buttons */}
                          <div className="flex gap-2 justify-end">
                            {(agent.commands && agent.commands.length > 0 && !isDaemon) && (
                                agent.commands.map(cmd => (
                                    <button
                                        key={cmd}
                                        onClick={() => handleAgentAction(agent.name, 'start')} // Start action triggers the default/selected command
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform active:scale-95"
                                    >
                                        Run: {cmd}
                                    </button>
                                ))
                            )}
                            {isDaemon && ( // Controls for daemon processes
                                <>
                                    <button
                                        onClick={() => handleAgentAction(agent.name, 'start')}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform active:scale-95"
                                    >
                                        Start
                                    </button>
                                    <button
                                        onClick={() => handleAgentAction(agent.name, 'stop')}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform active:scale-95"
                                    >
                                        Stop
                                    </button>
                                    <button
                                        onClick={() => handleAgentAction(agent.name, 'restart')}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform active:scale-95"
                                    >
                                        Restart
                                    </button>
                                </>
                            )}
                            {/* If it's a utility like time-agent, we might have specific actions */}
                            {agent.name === 'time-agent.sh' && (
                                <>
                                    <button
                                        onClick={() => executeAgentCommand(agent.name, 'get')}
                                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-medium rounded-lg shadow-md transition-all duration-200 transform active:scale-95"
                                    >
                                        Get Time
                                    </button>
                                    <input
                                        type="text"
                                        placeholder="e.g., May 7 20:15 2026"
                                        value={agentCommandInputs[agent.name] || ''}
                                        onChange={(e) => handleCommandInputChange(agent.name, e.target.value)}
                                        className="p-2 rounded-md bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:outline-none w-48"
                                        aria-label="Set time value"
                                    />
                                    <button
                                        onClick={() => executeAgentCommand(agent.name, `set ${agentCommandInputs[agent.name]}`)}
                                        disabled={!agentCommandInputs[agent.name]?.trim()}
                                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform active:scale-95"
                                    >
                                        Set Time
                                    </button>
                                </>
                            )}
                          </div>

                          {/* Command Execution Input (for agents that take arbitrary commands) */}
                          {agent.name !== 'time-agent.sh' && !isDaemon && !agent.commands?.includes('check') && agent.name !== 'overseer-agent.sh' && ( // Example: show input for agents that accept arbitrary commands
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Enter command..."
                                value={agentCommandInputs[agent.name] || ''}
                                onChange={(e) => handleCommandInputChange(agent.name, e.target.value)}
                                className="flex-grow p-2 rounded-md bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                aria-label={`Command for ${agent.displayName}`}
                              />
                              <button
                                onClick={() => executeAgentCommand(agent.name, agentCommandInputs[agent.name])}
                                disabled={!agentCommandInputs[agent.name]?.trim()}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform active:scale-95"
                              >
                                Run
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommandCenter;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
