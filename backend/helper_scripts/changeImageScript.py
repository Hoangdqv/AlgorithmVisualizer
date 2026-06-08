# Generate a test admin account
from database import db
from app import app
from models import Language

def change_image(image_name, new_image):
    with app.app_context():
        language = Language.query.filter_by(language=image_name).first()
        print(f"Current image for {image_name}: {language.docker_image}")

        language.docker_image = new_image
        db.session.commit()
        print(f"Updated image for {image_name}: {language.docker_image}")
if __name__ == '__main__':
    change_image('python', 'python-compiler:latest')