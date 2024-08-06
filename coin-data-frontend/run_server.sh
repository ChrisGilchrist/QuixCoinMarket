#!/bin/sh
echo "${Quix__Sdk__Token}" > /usr/share/nginx/html/sdk_token
echo "${Quix__Workspace__Id}" > /usr/share/nginx/html/workspace_id
echo "${Quix__Portal__Api}" > /usr/share/nginx/html/portal_api
echo "${updated-coin-data-topic}" > /usr/share/nginx/html/upated-coin-data
nginx -g "daemon off;"