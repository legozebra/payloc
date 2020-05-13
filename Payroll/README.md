#Welcome!
This is the primary code base for PayLoc Scheduler. Scheduler is the primary component (and the revenue generating component) of PayLoc Corporation. Clients can access and manage their shift information and issue payrolls using this SaaS app. 

# Tech Stack 
Here are some of the primary tech used in this. Most dependencies are managed through npm. 
 * Node JS (ES6 required - we use `async`)
 * jQuery + Materialize 
 * Webpack (`webpack-dev-server` if in development)
 * MongoDB 
 
#Deployment
All changes made to master are deployed to production in *real time*. While unit test can prevent some really obvious errors that crashes the app, it is crucial that you only push to master when you feel it is ready for production use. 
Always remember this app deals with PIIs and financial data. A logic bug could potentially cost real $ lost of us or clients. 
 
# Contact
Plesae contact Christopher Lee via Slack or Email (chrisl@payloc.io) if you have any questions. 