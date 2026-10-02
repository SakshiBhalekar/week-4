#!/usr/bin/env bash
# ==============================================================================
# AWS Cloud Foundations (Week 4) - Automated Infrastructure & App Deployment
# Author: Sakshi Bhalekar
# ==============================================================================

set -euo pipefail

STACK_NAME="cloud-week4-master-stack"
REGION="us-east-1"
DOMAIN="sakshibhalekar.dev"
SUBDOMAIN="api.sakshibhalekar.dev"

echo "===================================================================="
echo " Starting Deployment: Week 4 - Deployment & Automation"
echo " Author: Sakshi Bhalekar"
echo " Region: ${REGION}"
echo "===================================================================="

# Step 1: Validate CloudFormation Templates
echo "[1/4] Validating CloudFormation templates..."
aws cloudformation validate-template \
  --template-body file://cloudformation/master-stack.yaml \
  --region "${REGION}" > /dev/null
echo "Master stack template validated successfully."

# Step 2: Deploy CloudFormation Master Stack
echo "[2/4] Deploying master CloudFormation stack: ${STACK_NAME}..."
aws cloudformation deploy \
  --template-file cloudformation/master-stack.yaml \
  --stack-name "${STACK_NAME}" \
  --parameter-overrides \
      DomainName="${DOMAIN}" \
      SubdomainName="${SUBDOMAIN}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region "${REGION}"

# Step 3: Extract Outputs
echo "[3/4] Retrieving stack outputs..."
EB_URL=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='ElasticBeanstalkURL'].OutputValue" \
  --output text \
  --region "${REGION}")

echo "Elastic Beanstalk URL: http://${EB_URL}"
echo "Custom Domain URL:     http://${SUBDOMAIN}"

# Step 4: Health Check Ping
echo "[4/4] Verifying endpoint health status..."
curl -s -f "http://${EB_URL}/health" | jq . || echo "Endpoint initializing..."

echo "===================================================================="
echo " Deployment orchestration completed successfully!"
echo "===================================================================="
