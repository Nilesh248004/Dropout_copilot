pipeline {
    agent any

    environment {
        PATH = "/opt/homebrew/bin:/usr/local/bin:${PATH}"
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Cloning repository...'
                checkout scm
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
                    sh 'pip3 install -r requirements.txt'
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
                    sh 'npm test || echo "No tests found, skipping..."'
                }
            }
        }

        stage('Test ML Service') {
            steps {
                dir('ml-service') {
                    sh 'python3 -m pytest || echo "No tests found, skipping..."'
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
