# ==============================================================================
# AWS Cloud Foundations (Week 4) - PowerShell Deployment Script
# Author: Sakshi Bhalekar
# ==============================================================================

param (
    [string]$StackName = "cloud-week4-master-stack",
    [string]$Region = "us-east-1",
    [string]$DomainName = "sakshibhalekar.dev",
    [string]$SubdomainName = "api.sakshibhalekar.dev"
)

Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host " AWS Cloud Foundations (Week 4): Deployment & Automation" -ForegroundColor Green
Write-Host " Author: Sakshi Bhalekar" -ForegroundColor Yellow
Write-Host " Region: $Region" -ForegroundColor White
Write-Host "====================================================================" -ForegroundColor Cyan

# Step 1: Validate CloudFormation Template
Write-Host "`n[1/4] Validating CloudFormation master stack..." -ForegroundColor Cyan
try {
    aws cloudformation validate-template `
        --template-body file://cloudformation/master-stack.yaml `
        --region $Region | Out-Null
    Write-Host "Template validation succeeded." -ForegroundColor Green
} catch {
    Write-Warning "AWS CLI not detected or template error. Ensure AWS CLI is configured."
}

# Step 2: Deploy CloudFormation Stack
Write-Host "`n[2/4] Deploying CloudFormation Stack: $StackName..." -ForegroundColor Cyan
aws cloudformation deploy `
    --template-file cloudformation/master-stack.yaml `
    --stack-name $StackName `
    --parameter-overrides DomainName=$DomainName SubdomainName=$SubdomainName `
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM `
    --region $Region

# Step 3: Fetch Outputs
Write-Host "`n[3/4] Fetching Stack Outputs..." -ForegroundColor Cyan
$ebUrl = aws cloudformation describe-stacks `
    --stack-name $StackName `
    --query "Stacks[0].Outputs[?OutputKey=='ElasticBeanstalkURL'].OutputValue" `
    --output text `
    --region $Region

Write-Host "Elastic Beanstalk Endpoint: http://$ebUrl" -ForegroundColor Green
Write-Host "Custom Domain URL:          http://$SubdomainName" -ForegroundColor Green

# Step 4: Health Check Ping
Write-Host "`n[4/4] Probing Health Endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://$ebUrl/health" -Method Get
    $response | Format-List
} catch {
    Write-Host "Endpoint is provisioning or awaiting DNS propagation." -ForegroundColor Yellow
}

Write-Host "`nDeployment workflow complete!" -ForegroundColor Green
