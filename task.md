I would like to implement a nextjs application to sserve as a sonarqube/quality gateway alternative that also do the role of software catalog.

## This tool should support:
- Secret scanning
  - gitleaks
  - etc
- SCA (Software Composition Analysis):
  - native tools for specific languages (npm audit, pip audit, docker scan, etc.)
  - semgrep
  - etc
- SAST (Static Application Security Testing):
  - semgrep
  - sonarqube
  - etc
- DAST (Dynamic Application Security Testing):
  - OWASP ZAP
  - etc
- SBOM (Software Bill of Materials):
  - cyclone DX
  - etc

## this application should be able to:
- Store software/application information
- list the issues found by the tools in a organized form
- allow to filter the issues by software/application, tool, severity, etc.
- show a dashboard with the issues found by the tools and the software/application quality score
- group services that serve a single application together to ease the management of the application and grouped score
- allow to add/configure new tools for security scanning
- allow to add new software/application to the catalog and manage the software/application information
- be possible to configure a score threshold (quality gate) to break the pipeline if the score is below the threshold or if any new high or critical issue is found.
- be possible to assign issues to a user or a team to be reviewed and fixed.
- be possibel to create a issue on the software repository for the team to review and fix later.

## How this works:
- the applications send a request to theapplication to request the code to be run in order to intall the tools locally (if not already installed) and run the tools on the pipeline.
- for that in the pipeline we have a sequence of commands, first we request the code to run that will analize the repo (what machine does it run on, what os, what version of the tools, what is the most probable stack, etc.)
- after that, we send this info to the system that will then return another command to run the tools locally (if not already installed) and run the tools on the pipeline.
- the system will then return the results of the tools and the software/application quality score
- with the result, this software will then create the issues in the database and update the software/application quality score

## Extra features:
- configure the single sign on (SSO) for the application
- make possible to configure a application to be scanned without pipeline, running the tools on the machine that is hosting the application itself. for that, we need to configure the machine to have the tools installed and also a form of connecting with the external repositories like with a PAT or something