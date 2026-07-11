import json
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("Expenses")


def lambda_handler(event, context):
    try:

        if "body" in event:
            body = json.loads(event["body"])
        else:
            body = event

        table.delete_item(
            Key={
                "expenseId": body["expenseId"]
            }
        )

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "message": "Expense deleted successfully"
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "error": str(e)
            })
        }
