#Welcome!
Attached here are the files to handle my Javascript final project, PayLoc. I originally had a different idea for the final project, but when that didn't pan out, I decided to use the considerably larger and more involved codebase that I've been working on for a startup instead. I've spent a ton of time on this, and it should involve everything the assignment asks for.

Last night, I discovered that our live build, www.scheduler.payloc.io, was down due to a payment issue. After contacting VSTS Azure Support, they claimed it will take "a few days" to get it back up and running. In the meantime, I've temporarily hosted it at this link: http://13.68.244.70:1337/signup. Since it's been a while since I've had the chance to test literally every feature, I am not 100% sure that the version currently live is fully functioning.

That's where the video tutorials come in, which walk you through every feature of my site step by step, depending on whether your user type is a "manager" or "employee." The "PayLoc Manager Tutorial - Watch First" video provides some context for the second video, so I would recommend you watch it first to get a better feel of the codebase.



Startup Stuff/General Info I include for my team members:

This is the primary code base for PayLoc Scheduler. Scheduler is the primary component (and the revenue generating component) of PayLoc Corporation. Clients can access and manage their shift information and issue payrolls using this SaaS app.

# Tech Stack
Here are some of the primary tech used in this. Most dependencies are managed through npm.
 * Node JS (ES6 required - we use `async`)
 * jQuery + Materialize
 * Webpack (`webpack-dev-server` if in development)
 * MongoDB

#Deployment
All changes made to master are deployed to production in *real time*. While unit test can prevent some really obvious errors that crashes the app, it is crucial that you only push to master when you feel it is ready for production use.
Always remember this app deals with PIIs and financial data. A logic bug could potentially cost real $ lost by us or clients.
 
# Contact
Plesae contact Christopher Lee via Slack or Email (chrisl@payloc.io) if you have any questions.
