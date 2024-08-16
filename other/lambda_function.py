import boto3
import json

def lambda_handler(event, context):
    '''
    Returns the set of unique users from all events in CloudTrail within the specified period of time.
    '''
    start_time = event['start_time']
    end_time = event['end_time']

    cloudtrail = boto3.client('cloudtrail')

    # Initialize a set to store unique users
    unique_users = set()

    # Get CloudTrail events within the specified time interval
    paginator = cloudtrail.get_paginator('lookup_events')
    page_iterator = paginator.paginate(
        StartTime=start_time,
        EndTime=end_time
    )

    # Process the events to extract unique user identities
    for page in page_iterator:
        for event in page['Events']:
            user_identity = event.get('Username')
            if user_identity:
                unique_users.add(user_identity)

    return sorted(list(unique_users))
