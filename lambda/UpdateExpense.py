import json
import boto3
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table("Expenses")


def lambda_handler(event, context):

    print("EVENT RECEIVED:")
    print(event)

    try:

        body = json.loads(event["body"])

        table.update_item(
            Key={
                "expenseId": body["expenseId"]
            },
            UpdateExpression="""
                SET title=:t,
                    amount=:a,
                    category=:c,
                    #d=:dt,
                    #m=:m,
                    notes=:n
            """,
            ExpressionAttributeNames={
                "#d": "date",
                "#m": "month"
            },
            ExpressionAttributeValues={
                ":t": body["title"],
                ":a": Decimal(str(body["amount"])),
                ":c": body["category"],
                ":dt": body["date"],
                ":m": body["month"],
                ":n": body.get("notes", "")
            }
        )

        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "message": "Expense updated successfully"
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
