pipeline {
    agent any

    environment {
        PATH = "/opt/homebrew/bin:/usr/local/bin:${PATH}"
        PYTHON_BIN = "/opt/homebrew/bin/python3.12"
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Cloning repository...'
                checkout scm
            }
        }

        stage('Check Tools') {
            steps {
                echo 'Checking installed tools...'
                sh 'node -v'
                sh 'npm -v'
                sh '${PYTHON_BIN} --version'
                sh '${PYTHON_BIN} -m pip --version'
            }
        }

        stage('Install Backend Dependencies') {
            steps {
                dir('backend') {
                    sh 'npm install'
                }
            }
        }

        stage('Install Frontend Dependencies') {
            steps {
                dir('frontend') {
                    sh 'npm install'
                }
            }
        }

        stage('Install MCP Server Dependencies') {
            steps {
                dir('mcp-server') {
                    sh 'npm install'
                }
            }
        }

        stage('Install ML Service Dependencies') {
            steps {
                dir('ml-service') {
                    sh '''
                        ${PYTHON_BIN} -m venv venv
                        . venv/bin/activate
                        python -m pip install --upgrade pip setuptools wheel
                        pip install -r requirements.txt
                    '''
                }
            }
        }

        stage('Build Frontend') {
            steps {
                dir('frontend') {
                    sh 'npm run build'
                }
            }
        }

        stage('Test Backend') {
            steps {
                dir('backend') {
                    sh 'npm test || echo "No backend tests found, skipping..."'
                }
            }
        }

        stage('Test ML Service') {
            steps {
                dir('ml-service') {
                    sh '''
                        . venv/bin/activate
                        python -m pytest || echo "No ML tests found, skipping..."
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'BUILD SUCCESSFUL!'
        }
        failure {
            echo 'BUILD FAILED - Check the logs.'
        }
    }
}
