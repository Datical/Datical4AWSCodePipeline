var https = require('https');
var AWS = require('aws-sdk');
var assert = require('assert');

exports.handler = function(event, context, callback) {
//    console.info('Received event', event);

    var codepipeline = new AWS.CodePipeline();
    
    // Retrieve the Job ID from the Lambda action
    var jobId = event["CodePipeline.job"].id;

    // Retrieve the value of UserParameters from the Lambda action configuration in AWS CodePipeline, in this case a URL which will be
    // health checked by this function.
    var userParams = event["CodePipeline.job"].data.actionConfiguration.configuration.UserParameters; 
    var userParamsParsed = JSON.parse(userParams);
    console.log('User Parameters', userParamsParsed);
    
    // Notify AWS CodePipeline of a successful job
    var putJobSuccess = function(message) {
        var params = {
            jobId: jobId
        };
        codepipeline.putJobSuccessResult(params, function(err, data) {
            if(err) {
                context.fail(err);      
            } else {
                context.succeed(message);      
            }
        });
    };
    
    // Notify AWS CodePipeline of a failed job
    var putJobFailure = function(message) {
        var params = {
            jobId: jobId,
            failureDetails: {
                message: JSON.stringify(message),
                type: 'JobFailed',
                externalExecutionId: context.invokeid
            }
        };
        codepipeline.putJobFailureResult(params, function(err, data) {
            context.fail(message);      
        });
    };



//------------------------------------------------------------------------------------
//      access_token REST Call Detail
//------------------------------------------------------------------------------------


    // Build the post string from an object
    var post_data = 'username=' + userParamsParsed.userName +'&password=' + userParamsParsed.password + '&grant_type=password&client_id=datical-aws';


    // An object of options to indicate where to post to
    var post_options = {
        host: userParamsParsed.daticalUrl, //external ip
        port: '443',
        path: '/auth/realms/datical/protocol/openid-connect/token',
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': post_data.length,
            'Accept': '*/*'
        }
    };

    var post_request = https.request(post_options, function(res) {
        var body = '';
        var parsed_body = '';

        res.on('data', function(chunk)  {
            body += chunk;
        });

        res.on('end', function() {
           context.done(body);
           parsed_body = JSON.parse(body);
           deployRestAPICall(parsed_body.access_token, parsed_body.refresh_token);
        });    

        res.on('error', function(e) {
            context.fail('error:' + e.message);
        });
        
        try {
            // Check if the HTTP response has a 200 status
            assert(res.statusCode === 200);
            // Succeed the job
            putJobSuccess("Tests passed.");
            callback();

        } catch (ex) {
            // If any of the assertions failed then fail the job
            putJobFailure(ex);    
            callback(new Error(parsed_body));
        }    
        
    });

//------------------------------------------------------------------------------------
//      Initiate Operation REST Call Detail
//------------------------------------------------------------------------------------


var deployRestAPICall = function(access_token, refresh_token) {
    // Build the post string from an object
    var post_data_deploy = {
        clientId: 'datical-aws',
        stepId: userParamsParsed.stepId,
        refreshToken: refresh_token,
        operationType:'deploy',
        operationSettings: {
            labels:userParamsParsed.label,
            fullDeploy: true,
            generateDeploySql: false,
            generateRollbackSql: false,
            limitObjectProfiling: false,
            context: null }
            };
    var post_data_deploy_str = JSON.stringify(post_data_deploy);

    // An object of options to indicate where to post to
    var post_options_deploy = {
        host: userParamsParsed.daticalUrl, //external ip
        port: 443,
        path: '/api/v0/jenkins-ops/initiate',
        method: 'POST',
        rejectUnauthorized: false,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': post_data_deploy_str.length,
            'Accept': '*/*',
            'Authorization':  'Bearer ' + access_token
        }
    };

    var post_request_deploy = https.request(post_options_deploy, function(res) {
        var body = '';
        var parsed_body = '';

        res.on('data', function(chunk)  {
            body += chunk;
        });

        res.on('end', function() {
            context.done(body);
            parsed_body = JSON.parse(body);
            console.log(parsed_body);
        });

        res.on('error', function(e) {
            context.fail('error:' + e.message);
        });

        try {
            // Check if the HTTP response has a 200 status
            assert(res.statusCode === 200);
            // Succeed the job
//                    putJobSuccess("Tests passed.");
//                    callback();

        } catch (ex) {
            // If any of the assertions failed then fail the job
            putJobFailure(ex);    
            callback(new Error(parsed_body));
        }   
    });

    // post the data
       post_request_deploy.write(post_data_deploy_str);
       post_request_deploy.end();
};

    // post the data
    post_request.write(post_data);
    post_request.end();
};
    
    
