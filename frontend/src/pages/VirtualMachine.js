import React, { useState } from 'react';
import axios from 'axios';

function VirtualMachine() {
  const [ipAddress, setIpAddress] = useState('');
  const [port, setPort] = useState('');
  const [containers, setContainers] = useState([]);
  const [error, setError] = useState('');

  const handleIpChange = (e) => setIpAddress(e.target.value);
  const handlePortChange = (e) => setPort(e.target.value);

  const connectToDocker = async () => {
    try {
      setError('');
      const response = await axios.post('http://localhost:5000/api/docker/containers', { ipAddress, port });
      setContainers(response.data); // Update the state with the list of containers
    } catch (err) {
      setError('Failed to connect to the Docker server. Please check the IP address and port.');
      console.error(err);
    }
  };

  return (
    <div>
      <h1>Virtual Machine</h1>
      <p>Connect to a Docker server on a virtual machine to list all running images.</p>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          IP Address:
          <input
            type="text"
            value={ipAddress}
            onChange={handleIpChange}
            placeholder="e.g., 192.168.1.100"
            style={{ margin: '0 10px' }}
          />
        </label>
        
        <label>
          Port:
          <input
            type="text"
            value={port}
            onChange={handlePortChange}
            placeholder="e.g., 2375"
            style={{ margin: '0 10px' }}
          />
        </label>
        
        <button onClick={connectToDocker}>Connect</button>
      </div>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {containers.length > 0 ? (
        <div>
          <h2>Running Containers</h2>
          <ul>
            {containers.map((container) => (
              <li key={container.id}>
                <strong>{container.name}</strong> - {container.image} (Status: {container.status})
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p>No containers found or not connected yet.</p>
      )}
    </div>
  );
}

export default VirtualMachine;
