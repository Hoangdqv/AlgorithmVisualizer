"""baseline migration with binary blob columns

Revision ID: 9f8b7c6d5e4f
Revises:
Create Date: 2026-04-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9f8b7c6d5e4f'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if 'file' not in tables:
        op.create_table(
            'file',
            sa.Column('file_id', sa.Integer(), nullable=False),
            sa.Column('content', sa.Text(), nullable=True),
            sa.Column('content_blob', sa.LargeBinary(), nullable=True),
            sa.Column('content_mime', sa.String(length=100), nullable=True),
            sa.Column('lang_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['file_id'], ['filesystem_item.item_id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['lang_id'], ['language.lang_id']),
            sa.PrimaryKeyConstraint('file_id'),
        )
        return

    existing_columns = {col['name'] for col in inspector.get_columns('file')}

    if 'content_blob' not in existing_columns:
        op.add_column('file', sa.Column('content_blob', sa.LargeBinary(), nullable=True))

    if 'content_mime' not in existing_columns:
        op.add_column('file', sa.Column('content_mime', sa.String(length=100), nullable=True))


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if 'file' not in tables:
        return

    existing_columns = {col['name'] for col in inspector.get_columns('file')}

    if 'content_mime' in existing_columns:
        op.drop_column('file', 'content_mime')
    if 'content_blob' in existing_columns:
        op.drop_column('file', 'content_blob')
