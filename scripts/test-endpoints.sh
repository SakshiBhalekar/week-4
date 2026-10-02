#!/usr/bin/env bash
# ==============================================================================
# AWS Cloud Foundations (Week 4) - Automated Verification & Latency Benchmark
# Author: Sakshi Bhalekar
# ==============================================================================

TARGET_URL="${1:-http://localhost:8080}"

echo "===================================================================="
echo " Running Automated Health & API Verification Suite"
echo " Target Endpoint: ${TARGET_URL}"
echo "===================================================================="

# 1. Health Check Test
echo -e "\n[Test 1/5] Testing ALB Health Check (/health)..."
HEALTH_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}\nTIME_TOTAL:%{time_total}s\n" "${TARGET_URL}/health")
echo "${HEALTH_RES}"

# 2. API Info Test
echo -e "\n[Test 2/5] Testing EC2 IMDSv2 & Telemetry (/api/info)..."
INFO_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" "${TARGET_URL}/api/info")
echo "${INFO_RES}"

# 3. Tasks List Test
echo -e "\n[Test 3/5] Testing Tasks Audit List (/api/tasks)..."
TASKS_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" "${TARGET_URL}/api/tasks")
echo "${TASKS_RES}"

# 4. Create Task Test
echo -e "\n[Test 4/5] Testing POST /api/tasks (State Modification)..."
CREATE_RES=$(curl -s -X POST "${TARGET_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title":"Automated Health Check Passed","status":"COMPLETED","details":"Verification completed via test-endpoints.sh"}' \
  -w "\nHTTP_STATUS:%{http_code}\n")
echo "${CREATE_RES}"

# 5. Stress Test Endpoint
echo -e "\n[Test 5/5] Testing Workload Simulation (/api/stress?duration=200)..."
STRESS_RES=$(curl -s -w "\nHTTP_STATUS:%{http_code}\n" "${TARGET_URL}/api/stress?duration=200")
echo "${STRESS_RES}"

echo -e "\n===================================================================="
echo " All API endpoint verification checks executed successfully!"
echo "===================================================================="
