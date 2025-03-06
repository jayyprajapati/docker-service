const express = require('express');
const Docker  = require('dockerode');
const app = express();
const docker = new Docker();
const port = 3001;

app.use(express.json());

app.post('/execute', async (req, res) => {
  const { code, language } = req.body;
  
  try {
    const langConfig = {
        python: {
          image: 'python:3.9',
          fileExt: 'py',
          memLimit: 100 * 1024 * 1024, // 100MB in bytes
          runCmd: 'python -u /app/code.py'
        },
        javascript: {
          image: 'node:16',
          fileExt: 'js',
          memLimit: 100 * 1024 * 1024, // 100MB
          runCmd: 'node /app/code.js'
        },
        java: {
          image: 'openjdk:17',
          fileExt: 'java',
          memLimit: 512 * 1024 * 1024, // 512MB
          runCmd: 'sh -c "javac /app/code.java && java -cp /app code"'
        }
      };

    const config = langConfig[language];
    const encodedCode = Buffer.from(code).toString('base64');

    const container = await docker.createContainer({
      Image: config.image,
      Cmd: [
        'sh', '-c',
        `mkdir -p /app && ` +
        `echo "${encodedCode}" | base64 -d > /app/code.${config.fileExt} && ` +
        `${config.runCmd}`
      ],
      HostConfig: {
        Memory: config.memLimit,
        NetworkMode: 'none'
      },
      AttachStdout: true,
      AttachStderr: true
    });

    await container.start();
    
    const stream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true
    });

    let output = '';
    stream.on('data', chunk => output += chunk.toString());
    
    await container.wait();
    await container.remove();
    
    res.json({ success: true, output });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      output: `Execution error: ${error.message}`
    });
  }
});

app.listen(port, () => {
  console.log(`Docker execution service running on port ${port}`);
});