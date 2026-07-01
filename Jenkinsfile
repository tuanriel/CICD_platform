pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: node
      image: node:20
      command: ["cat"]
      tty: true
      resources:
        requests:
          cpu: "500m"
          memory: "512Mi"
        limits:
          cpu: "1"
          memory: "1Gi"
'''
            defaultContainer 'node'
        }
    }

    options {
        buildDiscarder(logRotator(artifactDaysToKeepStr: '7'))
    }

    stages {
        stage('Check branch') {
            steps {
                script {
                    if (!(env.BRANCH_NAME in ['main', 'master'])) {
                        currentBuild.result = 'NOT_BUILT'
                        error("Skip build: branch '${env.BRANCH_NAME}' không nằm trong ['main', 'master']")
                    }
                }
            }
        }

        stage('Checkout code') {
            steps {
                checkout scm
            }
        }

        stage('Install dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Upload build artifact') {
            steps {
                archiveArtifacts artifacts: 'dist/**', fingerprint: true
            }
        }
    }
}
