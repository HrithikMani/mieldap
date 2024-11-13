require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('ssh2');
const { Server } = require('ws');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const wss = new Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket connection established');

  let sshConn;

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'start') {
      // Start SSH connection
      sshConn = new Client();
      sshConn.on('ready', () => {
        console.log('SSH connection established');
        ws.send(JSON.stringify({ type: 'status', message: 'SSH connected.' }));

        sshConn.shell((err, stream) => {
          if (err) {
            console.error('Error starting shell:', err);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to start SSH shell.' }));
            return;
          }

          // Stream SSH output to WebSocket
          stream.on('data', (data) => {
            ws.send(JSON.stringify({ type: 'output', data: data.toString() }));
          });

          // Close SSH connection when the stream ends
          stream.on('close', () => {
            ws.send(JSON.stringify({ type: 'status', message: 'SSH connection closed.' }));
            sshConn.end();
          });

          // Receive input from WebSocket and send it to SSH
          ws.on('message', (commandMessage) => {
            const commandData = JSON.parse(commandMessage);
            if (commandData.type === 'command' && commandData.command) {
              stream.write(commandData.command + '\n');
            }
          });

          // Close the SSH session on 'end' command
          ws.on('message', (endMessage) => {
            const endData = JSON.parse(endMessage);
            if (endData.type === 'end') {
              stream.end('exit\n');
              sshConn.end();
            }
          });
        });
      }).connect({
        host: data.host,
        port: data.port || 22,
        username: data.containerUser,
        password: data.containerPassword,
      });

      sshConn.on('error', (err) => {
        console.error('SSH connection error:', err);
        ws.send(JSON.stringify({ type: 'error', message: 'SSH connection failed.' }));
      });

      sshConn.on('close', () => {
        console.log('SSH connection closed');
        ws.send(JSON.stringify({ type: 'status', message: 'SSH connection closed.' }));
      });
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (sshConn) sshConn.end(); // Ensure SSH connection is closed when WebSocket closes
  });
});

// Endpoint to SSH into the VM and list Docker containers
app.post('/api/docker/containers', (req, res) => {
  const { ipAddress, port, username, password } = req.body;

  const conn = new Client();
  
  console.log(`Attempting to SSH into ${ipAddress} as ${username} on port ${port || 22}`);

  conn.on('ready', () => {
    console.log('SSH Connection established.');

    conn.exec('sudo docker ps --format "{{json .}}"', (err, stream) => {
      if (err) {
        console.error(`Exec error: ${err}`);
        return res.status(500).json({ error: 'Failed to execute Docker command.' });
      }

      let output = '';

      stream.on('data', (data) => {
        console.log('Received data from Docker command:');
        console.log(data.toString());
        output += data.toString();
      });

      stream.on('close', () => {
        try {
          // Split output by newline to handle multiple JSON objects
          const containers = output
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => JSON.parse(line)); // Parse each JSON object

          // Map through containers to extract details
          const parsedContainers = containers.map(container => {
            let sshPort = null;
            if (container.Ports) {
              const portMappings = container.Ports.split(',');
              portMappings.forEach(mapping => {
                if (mapping.includes('->')) {
                  const port = mapping.split('->')[0].split(':')[1];
                  if (port) {
                    sshPort = port;
                  }
                }
              });
            }

            return {
              id: container.ID,
              image: container.Image,
              name: container.Names,
              status: container.Status,
              sshPort
            };
          });

          res.json(parsedContainers);
        } catch (parseError) {
          console.error('Error parsing Docker ps JSON:', parseError);
          res.status(500).json({ error: 'Failed to parse Docker ps output.' });
        }

        conn.end();
      });
    });
  }).connect({
    host: ipAddress,
    port: port || 22,
    username: username,
    password: password
  });

  conn.on('error', (err) => {
    console.error(`SSH connection error: ${err}`);
    res.status(500).json({ error: 'Failed to connect to the virtual machine. Check credentials and IP address.' });
  });

  conn.on('close', (had_error) => {
    console.log(`SSH connection closed. Had error: ${had_error}`);
  });
});
