import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './VirtualMachine.css';

function VirtualMachine() {
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [containers, setContainers] = useState([]);
  const [containerCredentials, setContainerCredentials] = useState({});
  const [sshOutput, setSshOutput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const ws = useRef(null);

  // Load saved credentials from localStorage if available
  useEffect(() => {
    const savedDetails = JSON.parse(localStorage.getItem('vmDetails'));
    if (savedDetails) {
      setIpAddress(savedDetails.ipAddress);
      setPort(savedDetails.port);
      setUsername(savedDetails.username);
      setPassword(savedDetails.password);
      setRememberMe(true);
    }
  }, []);

  const handleIpChange = (e) => setIpAddress(e.target.value);
  const handlePortChange = (e) => setPort(e.target.value);
  const handleUsernameChange = (e) => setUsername(e.target.value);
  const handlePasswordChange = (e) => setPassword(e.target.value);
  const handleRememberMeChange = (e) => setRememberMe(e.target.checked);

  const handleContainerCredentialChange = (containerId, field, value) => {
    setContainerCredentials(prevCredentials => ({
      ...prevCredentials,
      [containerId]: {
        ...prevCredentials[containerId],
        [field]: value,
      }
    }));
  };

  const connectToDocker = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post('http://localhost:5000/api/docker/containers', { 
        ipAddress, 
        port, 
        username, 
        password 
      });
      console.log('Containers data:', response.data);
      setContainers(Array.isArray(response.data) ? response.data : [response.data]);
    } catch (err) {
      setError('Failed to connect to the Docker server. Please check the IP address, port, username, and password.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }

    if (rememberMe) {
      localStorage.setItem('vmDetails', JSON.stringify({ ipAddress, port, username, password }));
    } else {
      localStorage.removeItem('vmDetails');
    }
  };

  const sshIntoContainer = (container) => {
    const credentials = containerCredentials[container.id] || {};
    const { containerUsername, containerPassword } = credentials;

    // Initialize WebSocket connection
    ws.current = new WebSocket('ws://localhost:5000');

    ws.current.onopen = () => {
      console.log('WebSocket connection established');
      ws.current.send(JSON.stringify({
        type: 'start',
        host: ipAddress,
        port: container.sshPort || 22,
        username,
        password,
        containerPort: container.sshPort,
        containerUser: containerUsername,
        containerPassword
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'output') {
        setSshOutput((prevOutput) => prevOutput + data.data);
      } else if (data.type === 'status') {
        console.log(data.message);
      } else if (data.type === 'error') {
        setError(data.message);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket connection closed');
    };
  };

  const sendCommand = (command) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'command', command }));
    }
  };

  const endSshSession = () => {
    if (ws.current) {
      ws.current.send(JSON.stringify({ type: 'end' }));
      ws.current.close();
      setSshOutput('');
    }
  };

  return (
    <div className="vm-container">
      <h1>Virtual Machine Connection</h1>
      <p className="description">
        Connect to a Docker server on a virtual machine to list all running containers.
      </p>

      <div className="form-container">
        <label className="input-label">
          IP Address:
          <input
            type="text"
            value={ipAddress}
            onChange={handleIpChange}
            placeholder="e.g., 192.168.1.100"
            className="input-field"
          />
        </label>
        
        <label className="input-label">
          Port:
          <input
            type="text"
            value={port}
            onChange={handlePortChange}
            placeholder="e.g., 22"
            className="input-field"
          />
        </label>
        
        <label className="input-label">
          Username:
          <input
            type="text"
            value={username}
            onChange={handleUsernameChange}
            placeholder="e.g., root"
            className="input-field"
          />
        </label>

        <label className="input-label">
          Password:
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            placeholder="Enter password"
            className="input-field"
          />
        </label>

        <div className="remember-me">
          <label>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={handleRememberMeChange}
              className="checkbox"
            />
            Remember Me
          </label>
        </div>

        <button className="connect-button" onClick={connectToDocker}>Connect</button>
      </div>
      
      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p className="loading-message">Loading containers...</p>
      ) : containers.length > 0 ? (
        <div className="container-list">
          <h2>Running Containers</h2>
          <ul>
            {containers.map((container) => (
              <li key={container.id} className="container-item">
                <strong>{container.name}</strong> - {container.image} (Status: {container.status}) - SSH Port: {container.sshPort}
                <div className="container-ssh">
                  <input
                    type="text"
                    placeholder="Username for SSH"
                    value={containerCredentials[container.id]?.containerUsername || ''}
                    onChange={(e) => handleContainerCredentialChange(container.id, 'containerUsername', e.target.value)}
                    className="input-ssh"
                  />
                  <input
                    type="password"
                    placeholder="Password for SSH"
                    value={containerCredentials[container.id]?.containerPassword || ''}
                    onChange={(e) => handleContainerCredentialChange(container.id, 'containerPassword', e.target.value)}
                    className="input-ssh"
                  />
                  <button onClick={() => sshIntoContainer(container)} className="ssh-button">
                    SSH into Container
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="no-containers">No containers found or not connected yet.</p>
      )}

      {/* SSH Output Display */}
      {sshOutput && (
        <div className="ssh-output">
          <h2>SSH Output</h2>
          <pre>{sshOutput}</pre>
          <input
            type="text"
            placeholder="Enter command"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                sendCommand(e.target.value);
                e.target.value = '';
              }
            }}
            className="command-input"
          />
          <button onClick={endSshSession} className="end-session-button">End Session</button>
        </div>
      )}
    </div>
  );
}

export default VirtualMachine;
