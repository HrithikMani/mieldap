const express = require('express');
const cors = require('cors');
const { exec } = require('child_process'); // Import exec to run shell commands

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Endpoint to connect to Docker server and list containers
app.post('/api/docker/containers', (req, res) => {
  const { ipAddress, port } = req.body;

  // Command to list Docker containers using remote Docker server
  const command = `docker -H tcp://${ipAddress}:${port} ps --format "{{.ID}}:{{.Image}}:{{.Names}}:{{.Status}}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: 'Failed to retrieve containers. Check IP address and port.' });
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return res.status(500).json({ error: stderr });
    }

    // Parse command output into a list of container objects
    const containers = stdout
      .trim()
      .split('\n')
      .map(line => {
        const [id, image, name, status] = line.split(':');
        return { id, image, name, status };
      });

    res.json(containers);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
